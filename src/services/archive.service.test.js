import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveService } from "./archive.service";

describe("archive categorized endpoint", () => {
  beforeEach(() => archiveService.clearReadCache());
  afterEach(() => vi.unstubAllGlobals());

  it("fetches categorized data with no-store without changing the full archive endpoint", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { categories: [], category_titles: [], category_sync: {} } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await archiveService.fetchCategorizedData();
    await archiveService.fetchData();

    expect(fetchMock.mock.calls[0]).toEqual([
      "/api/data?scope=categorized",
      expect.objectContaining({ cache: "no-store" }),
    ]);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/data");
  });

  it("shares one request between concurrent categorized callers", async () => {
    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise((resolve) => {
      resolveFetch = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { categories: [], category_titles: [], category_sync: {} },
        }),
      });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = archiveService.fetchCategorizedData();
    const second = archiveService.fetchCategorizedData();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    resolveFetch();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("derives categorized data from a concurrent full archive response", async () => {
    const data = {
      movies: [],
      watch_history: [],
      movie_memories: [],
      categories: [{ id: "CAT-MARVEL" }],
      category_titles: [],
      category_sync: { server_time: "2026-08-12T08:00:00.000Z" },
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const [full, categorized] = await Promise.all([
      archiveService.fetchData(),
      archiveService.fetchCategorizedData(),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(full.movies).toEqual([]);
    expect(categorized).toMatchObject({
      categories: [{ id: "CAT-MARVEL" }],
      category_sync: { server_time: "2026-08-12T08:00:00.000Z" },
    });
    expect(categorized).not.toHaveProperty("movies");
  });
});
