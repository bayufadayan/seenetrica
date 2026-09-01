import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const API_HANDLERS = new Map([
  ["/api/data", require("../api/data.js")],
  ["/api/tmdb/search", require("../api/tmdb/search.js")],
  ["/api/tmdb/details", require("../api/tmdb/details.js")],
  ["/api/memories/sign-upload", require("../api/memories/sign-upload.js")],
  ["/api/memories/cleanup", require("../api/memories/cleanup.js")],
  ["/api/memories/delete", require("../api/memories/delete.js")],
  ["/api/youtube/channel", require("../api/youtube/channel.js")],
  ["/api/youtube/videos", require("../api/youtube/videos.js")],
]);

export function localApiPlugin() {
  return {
    name: "seenetrica-local-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || "/", "http://localhost");
        const handler = API_HANDLERS.get(url.pathname);

        if (!handler) {
          next();
          return;
        }

        try {
          prepareRequest(request, url);
          prepareResponse(response);
          request.body = await readJsonBody(request);
          await handler(request, response);
        } catch (error) {
          sendDevelopmentError(response, error);
        }
      });
    },
  };
}

function prepareRequest(request, url) {
  request.query = Object.fromEntries(url.searchParams.entries());
}

function prepareResponse(response) {
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };

  response.json = (payload) => {
    if (!response.headersSent) {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    response.end(JSON.stringify(payload));
    return response;
  };
}

async function readJsonBody(request) {
  if (!["POST", "PUT", "PATCH"].includes(request.method || "")) return {};

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  return rawBody ? JSON.parse(rawBody) : {};
}

function sendDevelopmentError(response, error) {
  console.error("Local API error:", error);

  if (response.headersSent || response.writableEnded) return;

  const invalidJson = error instanceof SyntaxError;
  response.statusCode = invalidJson ? 400 : 500;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      success: false,
      message: invalidJson
        ? "Request body must contain valid JSON."
        : "The local API handler failed.",
    }),
  );
}
