import { afterEach, describe, expect, it, vi } from "vitest";
import { archiveService } from "./archive.service";

describe("archive categorized endpoint", () => {
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
});
