import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archive: {
    fetchCategorizedData: vi.fn(),
    fetchData: vi.fn(),
    writeAction: vi.fn(),
    getSessionPin: vi.fn(),
  },
  library: {
    applyCanonicalSnapshot: vi.fn(),
    mergeServerSnapshot: vi.fn(),
    readAll: vi.fn(),
    completeOutboxOperation: vi.fn(),
    hydrate: vi.fn(),
  },
}));

vi.mock("../../../services/archive.service", () => ({ archiveService: mocks.archive }));
vi.mock("./category-library-db.service", () => ({ categoryLibraryDb: mocks.library }));

import { categorySyncService } from "./category-sync.service";

const emptyState = { categories: [], titles: [], outbox: [], syncMeta: null };

function serverData(titles = []) {
  return {
    categories: [{ id: "CAT-MARVEL", name: "Marvel", slug: "marvel" }],
    category_titles: titles,
    category_sync: { server_time: "2026-08-12T12:00:00.000Z" },
  };
}

describe("categorized library sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.fetchCategorizedData.mockResolvedValue(serverData());
    mocks.library.readAll.mockResolvedValue(emptyState);
    mocks.library.hydrate.mockResolvedValue(emptyState);
    mocks.library.mergeServerSnapshot.mockResolvedValue(emptyState);
    mocks.library.applyCanonicalSnapshot.mockResolvedValue(emptyState);
  });

  it("pulls the lightweight categorized scope rather than the full archive", async () => {
    await categorySyncService.pull();
    expect(mocks.archive.fetchCategorizedData).toHaveBeenCalledOnce();
    expect(mocks.archive.fetchData).not.toHaveBeenCalled();
    expect(mocks.library.mergeServerSnapshot).toHaveBeenCalledOnce();
  });

  it("pushes dirty records, applies id_map, and completes only that batch", async () => {
    mocks.library.readAll.mockResolvedValue({
      categories: [{ id: "local-cat", name: "Noir", slug: "noir" }],
      titles: [{ id: "local-title", categoryId: "local-cat", tmdbId: 7, title: "Seven", baseTitle: "Seven", originalTitle: "Seven", type: "movie", identityKey: "movie:7", prerequisiteIds: [], isWatched: false }],
      outbox: [
        { id: "category:local-cat", kind: "category", recordId: "local-cat" },
        { id: "title:local-title", kind: "title", recordId: "local-title" },
      ],
    });
    mocks.archive.writeAction.mockResolvedValue({
      snapshot: serverData(),
      id_map: { categories: { "local-cat": "CAT-9" }, category_titles: { "local-title": "TITLE-9" } },
    });

    const result = await categorySyncService.sync("1234");

    expect(mocks.archive.writeAction).toHaveBeenCalledWith(
      "syncCategorizedLibrary",
      expect.objectContaining({
        categories: [expect.objectContaining({ id: "local-cat" })],
        category_titles: [expect.objectContaining({ category_id: "local-cat" })],
      }),
      "1234",
    );
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ categories: { "local-cat": "CAT-9" } }),
      ["category:local-cat", "title:local-title"],
    );
    expect(result).toMatchObject({ pushed: 2, remaining: 0 });
  });

  it("still performs a categorized pull when the outbox is empty", async () => {
    const result = await categorySyncService.sync("1234");
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.archive.fetchCategorizedData).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ pushed: 0, pulled: 1, remaining: 0 });
  });

  it("keeps a failed cleanup in the outbox", async () => {
    mocks.library.readAll.mockResolvedValue({
      categories: [],
      titles: [],
      outbox: [{ id: "iconCleanup:CAT", kind: "iconCleanup", recordId: "CAT", publicId: "old-icon" }],
    });
    mocks.archive.writeAction.mockRejectedValue(new Error("cleanup offline"));
    await expect(categorySyncService.sync("1234")).rejects.toThrow("cleanup offline");
    expect(mocks.library.completeOutboxOperation).not.toHaveBeenCalled();
  });

  it("background sync never prompts without an existing session PIN", async () => {
    mocks.archive.getSessionPin.mockReturnValue(null);
    await expect(categorySyncService.syncInBackground()).resolves.toEqual({ skipped: true });
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.archive.fetchCategorizedData).not.toHaveBeenCalled();
  });
});
