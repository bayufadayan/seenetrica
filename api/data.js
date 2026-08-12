const crypto = require("crypto");

// Keep this below vercel.json's 60 second function budget so the handler has
// time to turn an upstream timeout into a controlled JSON response.
const APPS_SCRIPT_TIMEOUT_MS = 50_000;

const ALLOWED_WRITE_ACTIONS = new Set([
  "createMovie",
  "updateMovie",
  "addViewing",
  "createMemory",
  "updateMemory",
  "syncCategorizedLibrary",
  "recordCategorizedViewing",
  "prepareCategoryIconUpload",
  "deleteCategoryIcon",
]);

const ALLOWED_READ_SCOPES = new Set(["categorized"]);

class DataProxyError extends Error {
  constructor(code, message, {
    cause = null,
    status = 502,
    stage,
    upstreamStatus = null,
  } = {}) {
    super(message);
    this.name = "DataProxyError";
    this.code = code;
    this.cause = cause;
    this.status = status;
    this.stage = stage;
    this.upstreamStatus = upstreamStatus;
  }
}

function elapsed(context) {
  return Date.now() - context.startedAt;
}

function redactSensitiveMessage(value) {
  let message = String(value || "Unknown error");
  const secrets = [
    process.env.APPS_SCRIPT_URL,
    process.env.APPS_SCRIPT_SECRET,
    process.env.SEENETRICA_WRITE_PIN,
  ].filter(Boolean);

  for (const secret of secrets) {
    message = message.split(secret).join("[redacted]");
  }

  return message.replace(/https?:\/\/\S+/gi, "[redacted-url]");
}

function logStage(context, stage, details = {}, level = "info") {
  context.stage = stage;
  const record = {
    requestId: context.requestId,
    method: context.method,
    scope: context.scope,
    stage,
    elapsedMs: elapsed(context),
    ...details,
  };
  console[level]("[seenetrica:data]", record);
}

function errorPayload(error, context) {
  const payload = {
    ok: false,
    success: false,
    error: error.code || "INTERNAL_ERROR",
    message: error.message || "The request could not be completed.",
    stage: error.stage || context.stage || "request_failed",
    requestId: context.requestId,
  };

  if (Number.isInteger(error.upstreamStatus)) {
    payload.upstreamStatus = error.upstreamStatus;
  }

  return payload;
}

function sendJson(response, status, payload, context) {
  const result = response.status(status).json(payload);
  logStage(context, "response_sent", { status });
  return result;
}

function fail(response, error, context) {
  const normalized = error instanceof DataProxyError
    ? error
    : new DataProxyError(
      "INTERNAL_ERROR",
      "The Seenetrica data proxy encountered an unexpected error.",
      { status: 500, stage: context.stage || "request_failed" },
    );

  logStage(context, "request_failed", {
    failureStage: normalized.stage || context.stage,
    errorCode: normalized.code,
    errorName: normalized.cause?.name || error?.name || normalized.name,
    errorMessage: redactSensitiveMessage(
      normalized.cause?.message || error?.message || normalized.message,
    ),
    upstreamStatus: normalized.upstreamStatus,
  }, "error");

  return sendJson(response, normalized.status, errorPayload(normalized, context), context);
}

function readScope(request) {
  const queryScope = request?.query?.scope;
  const requestedScope = queryScope !== undefined
    ? queryScope
    : new URL(request?.url || "/api/data", "http://localhost").searchParams.get("scope");

  if (Array.isArray(requestedScope)) {
    if (requestedScope.length !== 1) {
      throw new DataProxyError(
        "INVALID_SCOPE",
        "Only one data scope may be requested.",
        { status: 400, stage: "request_validation" },
      );
    }
    return String(requestedScope[0] || "").trim() || null;
  }

  return requestedScope === null || requestedScope === undefined
    ? null
    : String(requestedScope).trim() || null;
}

function readBody(request) {
  if (typeof request?.body !== "string") return request?.body || {};

  try {
    return JSON.parse(request.body);
  } catch {
    throw new DataProxyError(
      "INVALID_JSON_BODY",
      "The request body must contain valid JSON.",
      { status: 400, stage: "request_validation" },
    );
  }
}

function validateConfiguration(includeWritePin) {
  const required = ["APPS_SCRIPT_URL", "APPS_SCRIPT_SECRET"];
  if (includeWritePin) required.push("SEENETRICA_WRITE_PIN");
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length) {
    throw new DataProxyError(
      "CONFIGURATION_MISSING",
      `Missing server configuration: ${missing.join(", ")}.`,
      { status: 500, stage: "config_validation" },
    );
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(process.env.APPS_SCRIPT_URL);
  } catch (error) {
    throw new DataProxyError(
      "CONFIGURATION_INVALID",
      "The Apps Script server URL is invalid.",
      { cause: error, status: 500, stage: "config_validation" },
    );
  }

  if (!["http:", "https:"].includes(upstreamUrl.protocol)) {
    throw new DataProxyError(
      "CONFIGURATION_INVALID",
      "The Apps Script server URL must use HTTP or HTTPS.",
      { status: 500, stage: "config_validation" },
    );
  }

  return upstreamUrl;
}

function safeCompare(firstValue, secondValue) {
  const first = Buffer.from(String(firstValue || ""));
  const second = Buffer.from(String(secondValue || ""));

  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}

function responseContentType(response) {
  try {
    return response.headers?.get?.("content-type")?.slice(0, 160) || null;
  } catch {
    return null;
  }
}

async function fetchAppsScript(url, options, context) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);
  timeout.unref?.();
  logStage(context, "upstream_fetch_started");

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new DataProxyError(
        "UPSTREAM_TIMEOUT",
        "The Seenetrica data service did not respond within 50 seconds.",
        { status: 504, stage: "apps_script_fetch" },
      );
    }

    throw new DataProxyError(
      "UPSTREAM_NETWORK_ERROR",
      "Could not connect to the Seenetrica data service.",
      { cause: error, status: 502, stage: "apps_script_fetch" },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function parseAppsScriptResponse(appsScriptResponse, context) {
  const upstreamStatus = Number.isInteger(appsScriptResponse?.status)
    ? appsScriptResponse.status
    : null;
  const contentType = responseContentType(appsScriptResponse);

  logStage(context, "upstream_response_received", {
    upstreamStatus,
    contentType,
    redirected: Boolean(appsScriptResponse?.redirected),
  });

  let text;
  try {
    text = await appsScriptResponse.text();
  } catch {
    throw new DataProxyError(
      "UPSTREAM_BODY_READ_FAILED",
      "The Seenetrica data service response could not be read.",
      { status: 502, stage: "apps_script_response_read", upstreamStatus },
    );
  }

  if (!appsScriptResponse.ok) {
    throw new DataProxyError(
      "UPSTREAM_HTTP_ERROR",
      `The Seenetrica data service responded with HTTP ${upstreamStatus || "error"}.`,
      { status: 502, stage: "apps_script_response", upstreamStatus },
    );
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new DataProxyError(
      "UPSTREAM_INVALID_RESPONSE",
      "The Seenetrica data service returned invalid JSON.",
      { status: 502, stage: "apps_script_parse", upstreamStatus },
    );
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new DataProxyError(
      "UPSTREAM_INVALID_RESPONSE",
      "The Seenetrica data service returned an invalid response object.",
      { status: 502, stage: "apps_script_parse", upstreamStatus },
    );
  }

  logStage(context, "upstream_body_parsed", { upstreamStatus });
  return result;
}

async function readAppsScriptData(upstreamUrl, scope, context) {
  const url = new URL(upstreamUrl.toString());
  url.searchParams.set("secret", process.env.APPS_SCRIPT_SECRET);
  if (scope) url.searchParams.set("scope", scope);

  const appsScriptResponse = await fetchAppsScript(url, {
    method: "GET",
    redirect: "follow",
    headers: { Accept: "application/json" },
  }, context);

  return parseAppsScriptResponse(appsScriptResponse, context);
}

async function writeAppsScriptData(upstreamUrl, action, data, context) {
  let body;
  try {
    body = JSON.stringify({
      secret: process.env.APPS_SCRIPT_SECRET,
      action,
      data,
    });
  } catch {
    throw new DataProxyError(
      "INVALID_REQUEST_DATA",
      "The request data could not be serialized.",
      { status: 400, stage: "request_validation" },
    );
  }

  const appsScriptResponse = await fetchAppsScript(upstreamUrl.toString(), {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  }, context);

  return parseAppsScriptResponse(appsScriptResponse, context);
}

module.exports = async function handler(request, response) {
  const context = {
    requestId: "unavailable",
    method: "UNKNOWN",
    scope: null,
    stage: "request_received",
    startedAt: Date.now(),
  };

  try {
    context.requestId = crypto.randomUUID();
    context.method = String(request?.method || "UNKNOWN").toUpperCase();
    if (context.method === "GET") context.scope = readScope(request);

    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Request-Id", context.requestId);
    logStage(context, "request_received");

    if (!["GET", "POST"].includes(context.method)) {
      response.setHeader("Allow", "GET, POST");
      throw new DataProxyError(
        "METHOD_NOT_ALLOWED",
        "Method not allowed.",
        { status: 405, stage: "request_validation" },
      );
    }

    if (context.scope && !ALLOWED_READ_SCOPES.has(context.scope)) {
      throw new DataProxyError(
        "INVALID_SCOPE",
        "Invalid data scope.",
        { status: 400, stage: "request_validation" },
      );
    }

    const upstreamUrl = validateConfiguration(context.method === "POST");
    logStage(context, "config_validated");

    if (context.method === "GET") {
      const result = await readAppsScriptData(upstreamUrl, context.scope, context);
      if (!result.success) {
        return sendJson(response, 502, {
          ...result,
          ok: false,
          success: false,
          error: result.error || "UPSTREAM_REJECTED",
          stage: "apps_script_application",
          requestId: context.requestId,
        }, context);
      }
      return sendJson(response, 200, result, context);
    }

    const body = readBody(request);
    if (!safeCompare(body.pin, process.env.SEENETRICA_WRITE_PIN)) {
      throw new DataProxyError(
        "AUTHENTICATION_FAILED",
        "Incorrect PIN.",
        { status: 401, stage: "request_authentication" },
      );
    }

    const action = String(body.action || "");
    if (!ALLOWED_WRITE_ACTIONS.has(action)) {
      throw new DataProxyError(
        "INVALID_WRITE_ACTION",
        "Invalid write action.",
        { status: 400, stage: "request_validation" },
      );
    }

    const result = await writeAppsScriptData(upstreamUrl, action, body.data || {}, context);
    if (!result.success) {
      const status = result.message === "Unauthorized" ? 502 : 400;
      return sendJson(response, status, {
        ...result,
        ok: false,
        success: false,
        error: result.error || "UPSTREAM_REJECTED",
        stage: "apps_script_application",
        requestId: context.requestId,
      }, context);
    }

    return sendJson(response, 200, result, context);
  } catch (error) {
    return fail(response, error, context);
  }
};
