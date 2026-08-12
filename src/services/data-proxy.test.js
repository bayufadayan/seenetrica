import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../api/data.js";

const originalEnvironment = {
  APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL,
  APPS_SCRIPT_SECRET: process.env.APPS_SCRIPT_SECRET,
  SEENETRICA_WRITE_PIN: process.env.SEENETRICA_WRITE_PIN,
};

function appsScriptResponse(payload) {
  return {
    ok: true,
    status: 200,
    text: vi.fn(async () => JSON.stringify(payload)),
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

describe("/api/data categorized action proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    await handler({ method: "POST", body: { pin: "1234", action, data } }, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(response.payload.data).toMatchObject({ status: "ok", id_map: {} });
    const forwarded = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(forwarded).toEqual({ secret: "server-secret", action, data });
    expect(forwarded).not.toHaveProperty("pin");
  });

  it("marks GET responses no-store and keeps the Apps Script payload", async () => {
    const payload = {
      success: true,
      data: { categories: [], category_titles: [], category_sync: {} },
    };
    vi.stubGlobal("fetch", vi.fn(async () => appsScriptResponse(payload)));
    const response = vercelResponse();

    await handler({ method: "GET" }, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(response.payload).toEqual(payload);
  });

  it("forwards the categorized scope and keeps the secret server-side", async () => {
    const fetchMock = vi.fn(async () => appsScriptResponse({
      success: true,
      data: { categories: [], category_titles: [], category_sync: {} },
    }));
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
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(response.payload)).not.toContain("server-secret");
    expect(response.statusCode).toBe(200);
  });

  it("aborts Apps Script after 120 seconds and returns a clear 504 response", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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

      await vi.advanceTimersByTimeAsync(119_999);
      expect(response.statusCode).toBeNull();
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await request;

      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(response.statusCode).toBe(504);
      expect(response.payload).toEqual({
        success: false,
        message: "The Seenetrica data service did not respond within 120 seconds.",
      });
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("also marks rejected POST responses no-store", async () => {
    const response = vercelResponse();
    await handler({ method: "POST", body: { pin: "wrong", action: "syncCategorizedLibrary", data: {} } }, response);
    expect(response.statusCode).toBe(401);
    expect(response.headers["Cache-Control"]).toBe("no-store");
  });
});
