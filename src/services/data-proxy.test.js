import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../api/data.js";

const originalEnvironment = {
  APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL,
  APPS_SCRIPT_SECRET: process.env.APPS_SCRIPT_SECRET,
  SEENETRICA_WRITE_PIN: process.env.SEENETRICA_WRITE_PIN,
};

function appsScriptResponse(payload, {
  contentType = "application/json; charset=utf-8",
  raw,
  redirected = false,
  status = 200,
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected,
    headers: { get: vi.fn(() => contentType) },
    text: vi.fn(async () => raw ?? JSON.stringify(payload)),
  };
}

function vercelResponse() {
  return {
    headers: {},
    statusCode: null,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function expectStructuredError(response, status, code, stage) {
  expect(response.statusCode).toBe(status);
  expect(response.payload).toMatchObject({
    ok: false,
    success: false,
    error: code,
    stage,
    message: expect.any(String),
    requestId: expect.any(String),
  });
  expect(() => JSON.stringify(response.payload)).not.toThrow();
}

describe("/api/data proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.APPS_SCRIPT_URL = "https://script.google.test/exec";
    process.env.APPS_SCRIPT_SECRET = "server-secret";
    process.env.SEENETRICA_WRITE_PIN = "1234";
  });

  afterAll(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it.each([
    "syncCategorizedLibrary",
    "recordCategorizedViewing",
    "prepareCategoryIconUpload",
    "deleteCategoryIcon",
  ])("forwards %s with its data and server-side secret intact", async (action) => {
    const fetchMock = vi.fn(async () => appsScriptResponse({
      success: true,
      data: { status: "ok", snapshot: { categories: [], category_titles: [] }, id_map: {} },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const data = { nested: { keep: true }, titles: [{ id: "one" }] };
    const response = vercelResponse();

    await expect(handler({
      method: "POST",
      body: { pin: "1234", action, data },
    }, response)).resolves.toBe(response);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(response.headers["X-Request-Id"]).toEqual(expect.any(String));
    expect(response.payload.data).toMatchObject({ status: "ok", id_map: {} });
    const forwarded = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(forwarded).toEqual({ secret: "server-secret", action, data });
    expect(forwarded).not.toHaveProperty("pin");
  });

  it("successfully proxies the full archive GET", async () => {
    const payload = {
      success: true,
      data: { movies: [], watch_history: [], movie_memories: [] },
    };
    const fetchMock = vi.fn(async () => appsScriptResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const response = vercelResponse();

    await handler({ method: "GET", url: "/api/data" }, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(response.payload).toEqual(payload);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("scope")).toBeNull();
  });

  it("successfully proxies the categorized scope and follows redirects", async () => {
    const payload = {
      success: true,
      data: { categories: [], category_titles: [], category_sync: {} },
    };
    const fetchMock = vi.fn(async () => appsScriptResponse(payload, { redirected: true }));
    vi.stubGlobal("fetch", fetchMock);
    const response = vercelResponse();

    await handler({
      method: "GET",
      url: "/api/data?scope=categorized",
      query: { scope: "categorized" },
    }, response);

    const upstreamUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(upstreamUrl.searchParams.get("scope")).toBe("categorized");
    expect(upstreamUrl.searchParams.get("secret")).toBe("server-secret");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "follow" });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(response.payload)).not.toContain("server-secret");
    expect(response.statusCode).toBe(200);
  });

  it("turns an upstream non-2xx response into structured JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => appsScriptResponse(null, {
      contentType: "text/html",
      raw: "<html>Service unavailable</html>",
      status: 503,
    })));
    const response = vercelResponse();

    await handler({ method: "GET", url: "/api/data" }, response);

    expectStructuredError(response, 502, "UPSTREAM_HTTP_ERROR", "apps_script_response");
    expect(response.payload.upstreamStatus).toBe(503);
  });

  it.each([
    ["HTML", "<html>Sign in</html>", "text/html"],
    ["empty text", "", "application/json"],
  ])("turns an upstream %s response into structured JSON", async (_label, raw, contentType) => {
    vi.stubGlobal("fetch", vi.fn(async () => appsScriptResponse(null, { contentType, raw })));
    const response = vercelResponse();

    await handler({ method: "GET", url: "/api/data" }, response);

    expectStructuredError(response, 502, "UPSTREAM_INVALID_RESPONSE", "apps_script_parse");
  });

  it("turns an upstream network error into structured JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const response = vercelResponse();

    await expect(handler({ method: "GET", url: "/api/data" }, response)).resolves.toBe(response);

    expectStructuredError(response, 502, "UPSTREAM_NETWORK_ERROR", "apps_script_fetch");
  });

  it("aborts Apps Script after 50 seconds and returns a structured 504", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = vercelResponse();

    try {
      const request = handler({
        method: "GET",
        url: "/api/data?scope=categorized",
        query: { scope: "categorized" },
      }, response);

      await vi.advanceTimersByTimeAsync(49_999);
      expect(response.statusCode).toBeNull();
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toBe(response);

      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expectStructuredError(response, 504, "UPSTREAM_TIMEOUT", "apps_script_fetch");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["APPS_SCRIPT_URL", "APPS_SCRIPT_SECRET"])(
    "returns structured JSON without fetching when %s is missing",
    async (name) => {
      delete process.env[name];
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const response = vercelResponse();

      await handler({ method: "GET", url: "/api/data" }, response);

      expect(fetchMock).not.toHaveBeenCalled();
      expectStructuredError(response, 500, "CONFIGURATION_MISSING", "config_validation");
    },
  );

  it("returns structured JSON before fetching when the Apps Script URL is invalid", async () => {
    process.env.APPS_SCRIPT_URL = "not a URL";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = vercelResponse();

    await expect(handler({ method: "GET", url: "/api/data" }, response)).resolves.toBe(response);

    expect(fetchMock).not.toHaveBeenCalled();
    expectStructuredError(response, 500, "CONFIGURATION_INVALID", "config_validation");
  });

  it("returns structured JSON for malformed POST bodies without an uncaught throw", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = vercelResponse();

    await expect(handler({ method: "POST", body: "{" }, response)).resolves.toBe(response);

    expect(fetchMock).not.toHaveBeenCalled();
    expectStructuredError(response, 400, "INVALID_JSON_BODY", "request_validation");
  });

  it("logs correlation stages without logging secrets or the Apps Script URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => appsScriptResponse({ success: true, data: {} })));
    const response = vercelResponse();

    await handler({ method: "GET", url: "/api/data?scope=categorized" }, response);

    const logs = console.info.mock.calls.map((call) => call[1]);
    expect(logs.map((entry) => entry.stage)).toEqual([
      "request_received",
      "config_validated",
      "upstream_fetch_started",
      "upstream_response_received",
      "upstream_body_parsed",
      "response_sent",
    ]);
    expect(new Set(logs.map((entry) => entry.requestId))).toEqual(new Set([
      response.headers["X-Request-Id"],
    ]));
    expect(JSON.stringify(logs)).not.toContain("server-secret");
    expect(JSON.stringify(logs)).not.toContain("script.google.test");
  });
});
