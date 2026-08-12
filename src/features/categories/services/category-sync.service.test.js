import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archive: { fetchData: vi.fn(), writeAction: vi.fn(), getSessionPin: vi.fn() },
  player: { getLegacyTitles: vi.fn() },
  library: {
    bootstrapLegacyMarvel: vi.fn(),
    markLegacyBootstrapComplete: vi.fn(),
    applyCanonicalSnapshot: vi.fn(),
    mergeServerSnapshot: vi.fn(),
    readAll: vi.fn(),
    completeOutboxOperation: vi.fn(),
    hydrate: vi.fn(),
  },
}));

vi.mock("../../../services/archive.service", () => ({ archiveService: mocks.archive }));
vi.mock("../../player/services/player-db.service", () => ({ playerDb: mocks.player }));
vi.mock("./category-library-db.service", () => ({ categoryLibraryDb: mocks.library }));

import { categorySyncService } from "./category-sync.service";

function serverData(marker = null) {
  return {
    categories: [{ id: "CAT-MARVEL", name: "Marvel", slug: "marvel" }],
    category_titles: [],
    category_sync: { legacy_marvel_migration_completed_at: marker, server_time: "2026-08-12" },
  };
}

describe("category migration and sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.fetchData.mockResolvedValue(serverData("done"));
    mocks.player.getLegacyTitles.mockResolvedValue([]);
    mocks.library.readAll.mockResolvedValue({ categories: [], titles: [], outbox: [] });
    mocks.library.hydrate.mockResolvedValue({ categories: [], titles: [], outbox: [] });
  });

  it("calls legacy migration when the marker is empty and titles exist", async () => {
    mocks.archive.fetchData.mockResolvedValue(serverData(null));
    mocks.player.getLegacyTitles.mockResolvedValue([{ id: "legacy-title", tmdbId: 1 }]);
    mocks.archive.writeAction.mockResolvedValue({
      status: "migrated",
      snapshot: { categories: [], category_titles: [], legacy_marvel_migration_completed_at: "done" },
    });
    await categorySyncService.pull({ pin: "1234" });
    expect(mocks.archive.writeAction).toHaveBeenCalledWith("migrateLegacyMarvel", { titles: [{ id: "legacy-title", tmdbId: 1 }] }, "1234");
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledOnce();
  });

  it("never uploads second-browser legacy data when the server marker exists", async () => {
    mocks.player.getLegacyTitles.mockResolvedValue([{ id: "other-browser" }]);
    await categorySyncService.pull({ pin: "1234" });
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.library.markLegacyBootstrapComplete).toHaveBeenCalledOnce();
    expect(mocks.library.mergeServerSnapshot).toHaveBeenCalledOnce();
  });

  it("does not mark migration complete or delete legacy data after failure", async () => {
    mocks.archive.fetchData.mockResolvedValue(serverData(null));
    mocks.player.getLegacyTitles.mockResolvedValue([{ id: "legacy-title" }]);
    mocks.archive.writeAction.mockRejectedValue(new Error("offline"));
    await expect(categorySyncService.pull({ pin: "1234" })).rejects.toThrow("offline");
    expect(mocks.library.markLegacyBootstrapComplete).not.toHaveBeenCalled();
    expect(mocks.player.getLegacyTitles).toHaveBeenCalled();
  });

  it("sends dirty records and applies the canonical snapshot and id map", async () => {
    mocks.library.readAll.mockResolvedValue({
      categories: [{ id: "local-cat", name: "Noir", slug: "noir" }],
      titles: [{ id: "local-title", categoryId: "local-cat", tmdbId: 7, title: "Seven", baseTitle: "Seven", originalTitle: "Seven", type: "movie", identityKey: "movie:7", prerequisiteIds: [], isWatched: false }],
      outbox: [
        { id: "category:local-cat", kind: "category", recordId: "local-cat" },
        { id: "title:local-title", kind: "title", recordId: "local-title" },
      ],
    });
    mocks.archive.writeAction.mockResolvedValue({
      snapshot: { categories: [], category_titles: [], legacy_marvel_migration_completed_at: "done" },
      id_map: { categories: { "local-cat": "CAT-9" }, category_titles: { "local-title": "TITLE-9" } },
    });
    await categorySyncService.sync("1234");
    expect(mocks.archive.writeAction).toHaveBeenCalledWith(
      "syncCategorizedLibrary",
      expect.objectContaining({ categories: [expect.objectContaining({ id: "local-cat" })], category_titles: [expect.objectContaining({ category_id: "local-cat" })] }),
      "1234",
    );
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ categories: { "local-cat": "CAT-9" } }),
      ["category:local-cat", "title:local-title"],
    );
  });

  it("cleans a replaced icon only after library sync and keeps retry state on failure", async () => {
    mocks.library.readAll.mockResolvedValue({
      categories: [],
      titles: [],
      outbox: [{ id: "iconCleanup:CAT", kind: "iconCleanup", recordId: "CAT", publicId: "old-icon" }],
    });
    mocks.archive.writeAction.mockRejectedValue(new Error("cleanup offline"));
    await expect(categorySyncService.sync("1234")).rejects.toThrow("cleanup offline");
    expect(mocks.archive.writeAction).toHaveBeenCalledWith("deleteCategoryIcon", { public_id: "old-icon" }, "1234");
    expect(mocks.library.completeOutboxOperation).not.toHaveBeenCalled();
  });
});
