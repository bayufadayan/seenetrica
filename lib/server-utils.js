const crypto = require("crypto");

function safeCompare(firstValue, secondValue) {
  const first = Buffer.from(String(firstValue || ""));
  const second = Buffer.from(String(secondValue || ""));

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function parseJsonBody(request) {
  if (typeof request.body === "string") {
    return JSON.parse(request.body);
  }

  return request.body || {};
}

function missingEnvironmentVariables(names) {
  return names.filter((name) => !process.env[name]);
}

function createCloudinarySignature(parameters, apiSecret) {
  const serialized = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value)])
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${serialized}${apiSecret}`)
    .digest("hex");
}

async function parseAppsScriptResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Apps Script returned an invalid response.");
  }
}

async function readAppsScriptData() {
  const url = new URL(process.env.APPS_SCRIPT_URL);
  url.searchParams.set("secret", process.env.APPS_SCRIPT_SECRET);

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Apps Script responded with HTTP ${response.status}.`);
  }

  return parseAppsScriptResponse(response);
}

async function writeAppsScriptData(action, data) {
  const response = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      secret: process.env.APPS_SCRIPT_SECRET,
      action,
      data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apps Script responded with HTTP ${response.status}.`);
  }

  return parseAppsScriptResponse(response);
}

async function destroyCloudinaryAsset(publicId, resourceType = "image") {
  if (!["image", "video"].includes(resourceType)) {
    throw new Error("Cloudinary resource type must be image or video.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = {
    invalidate: "true",
    public_id: publicId,
    timestamp,
  };

  const signature = createCloudinarySignature(
    parameters,
    process.env.CLOUDINARY_API_SECRET,
  );

  const form = new URLSearchParams({
    ...parameters,
    api_key: process.env.CLOUDINARY_API_KEY,
    signature,
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      process.env.CLOUDINARY_CLOUD_NAME,
    )}/${resourceType}/destroy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form,
    },
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !["ok", "not found"].includes(result.result)) {
    throw new Error(result.error?.message || "Cloudinary could not delete the media asset.");
  }

  return result;
}

module.exports = {
  createCloudinarySignature,
  destroyCloudinaryAsset,
  missingEnvironmentVariables,
  parseJsonBody,
  readAppsScriptData,
  safeCompare,
  writeAppsScriptData,
};

