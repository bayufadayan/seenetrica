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

import {
  categorySyncService,
  summarizeLegacyTitles,
  verifyLegacyMigrationResponse,
} from "./category-sync.service";

const emptyState = { categories: [], titles: [], outbox: [], syncMeta: null };

function legacyMovie(overrides = {}) {
  return {
    id: "legacy-1",
    tmdbId: 1,
    title: "Iron Man",
    baseTitle: "Iron Man",
    originalTitle: "Iron Man",
    releaseDate: "2008-05-02",
    type: "movie",
    identityKey: "movie:1",
    isWatched: true,
    prerequisiteIds: [],
    ...overrides,
  };
}

function categoryApi() {
  return { id: "CAT-MARVEL", name: "Marvel", slug: "marvel" };
}

function titleApi(source, overrides = {}) {
  return {
    id: source.id,
    category_id: "CAT-MARVEL",
    tmdb_id: source.tmdbId,
    title: source.title,
    base_title: source.baseTitle,
    original_title: source.originalTitle,
    release_date: source.releaseDate,
    media_type: source.type,
    season_number: source.seasonNumber ?? null,
    identity_key: source.identityKey,
    is_watched: source.isWatched,
    prerequisite_ids: source.prerequisiteIds || [],
    ...overrides,
  };
}

function serverData(marker = null, titles = []) {
  return {
    categories: [categoryApi()],
    category_titles: titles,
    category_sync: {
      legacy_marvel_migration_completed_at: marker,
      server_time: "2026-08-12T12:00:00.000Z",
    },
  };
}

function migrationSnapshot(marker = "done", titles = []) {
  return {
    categories: [categoryApi()],
    category_titles: titles,
    legacy_marvel_migration_completed_at: marker,
    server_time: "2026-08-12T12:00:00.000Z",
  };
}

describe("legacy Marvel inspection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.fetchData.mockResolvedValue(serverData("done"));
    mocks.player.getLegacyTitles.mockResolvedValue([]);
    mocks.library.readAll.mockResolvedValue(emptyState);
    mocks.library.hydrate.mockResolvedValue(emptyState);
    mocks.library.mergeServerSnapshot.mockResolvedValue(emptyState);
    mocks.library.applyCanonicalSnapshot.mockResolvedValue(emptyState);
  });

  it("requires confirmation without posting or bootstrapping when the marker is empty", async () => {
    const legacy = legacyMovie();
    mocks.archive.fetchData.mockResolvedValue(serverData(null));
    mocks.player.getLegacyTitles.mockResolvedValue([legacy]);

    const result = await categorySyncService.inspectLegacyMarvelMigration();

    expect(result).toMatchObject({
      status: "confirmation_required",
      migrationRequired: true,
      summary: { total: 1, movies: 1, watched: 1, unwatched: 0 },
    });
    expect(result.legacyTitles[0]).toMatchObject({ title: "Iron Man", identityKey: "movie:1" });
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.library.bootstrapLegacyMarvel).not.toHaveBeenCalled();
    expect(mocks.library.mergeServerSnapshot).toHaveBeenCalledOnce();
    expect(mocks.library.applyCanonicalSnapshot).not.toHaveBeenCalled();
  });

  it("uses a completed server snapshot canonically and ignores second-browser legacy data", async () => {
    mocks.player.getLegacyTitles.mockResolvedValue([legacyMovie({ id: "other-browser" })]);
    const result = await categorySyncService.inspectLegacyMarvelMigration();

    expect(result).toMatchObject({ status: "completed", migrationRequired: false, marker: "done" });
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledOnce();
    expect(mocks.library.mergeServerSnapshot).not.toHaveBeenCalled();
    expect(mocks.library.markLegacyBootstrapComplete).toHaveBeenCalledOnce();
  });

  it("rejects a GET payload without the required category_sync object", async () => {
    mocks.archive.fetchData.mockResolvedValue({ categories: [], category_titles: [] });
    await expect(categorySyncService.inspectLegacyMarvelMigration()).rejects.toMatchObject({
      code: "invalid_snapshot",
      stage: "checking_server",
    });
    expect(mocks.library.mergeServerSnapshot).not.toHaveBeenCalled();
  });

  it("reports summary counts for movies, series, watched state, and relationships", () => {
    const summary = summarizeLegacyTitles([
      legacyMovie({ prerequisiteIds: ["legacy-2"] }),
      legacyMovie({ id: "legacy-2", tmdbId: 2, identityKey: "series:2:season:1", type: "series", seasonNumber: 1, isWatched: false }),
    ]);
    expect(summary).toEqual({
      total: 2,
      movies: 1,
      series: 1,
      watched: 1,
      unwatched: 1,
      prerequisites: 1,
    });
  });
});

describe("confirmed legacy Marvel migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.fetchData.mockResolvedValue(serverData(null));
    mocks.player.getLegacyTitles.mockResolvedValue([legacyMovie()]);
    mocks.library.applyCanonicalSnapshot.mockResolvedValue(emptyState);
    mocks.library.mergeServerSnapshot.mockResolvedValue(emptyState);
    mocks.library.hydrate.mockResolvedValue(emptyState);
  });

  it("rechecks GET, rereads IndexedDB, then posts every latest record with the PIN", async () => {
    const preview = legacyMovie();
    const latest = [preview, legacyMovie({ id: "legacy-2", tmdbId: 2, identityKey: "movie:2", title: "The Incredible Hulk", baseTitle: "The Incredible Hulk" })];
    mocks.player.getLegacyTitles.mockResolvedValue(latest);
    mocks.archive.writeAction.mockResolvedValue({
      status: "migrated",
      migrated_count: 2,
      snapshot: migrationSnapshot("done", latest.map(titleApi)),
    });
    const stages = [];

    const result = await categorySyncService.confirmLegacyMarvelMigration("1234", {
      onStage: (stage) => stages.push(stage),
    });

    expect(mocks.archive.fetchData.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.archive.writeAction.mock.invocationCallOrder[0]);
    expect(mocks.archive.writeAction).toHaveBeenCalledWith(
      "migrateLegacyMarvel",
      { titles: latest },
      "1234",
    );
    expect(result).toMatchObject({ status: "migrated", migratedCount: 2, marker: "done" });
    expect(stages).toEqual([
      "checking_server",
      "uploading_migration",
      "verifying_migration",
      "refreshing_cache",
    ]);
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledOnce();
    expect(mocks.library.markLegacyBootstrapComplete).toHaveBeenCalledOnce();
  });

  it("skips POST and applies the server snapshot when another browser won the race", async () => {
    mocks.archive.fetchData.mockResolvedValue(serverData("other-browser-done"));
    const result = await categorySyncService.confirmLegacyMarvelMigration("1234");

    expect(result).toMatchObject({ status: "already_completed", marker: "other-browser-done" });
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.player.getLegacyTitles).not.toHaveBeenCalled();
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledOnce();
  });

  it("accepts already_completed after POST without comparing this browser's identities", async () => {
    mocks.archive.writeAction.mockResolvedValue({
      status: "already_completed",
      snapshot: migrationSnapshot("other-browser-done", []),
    });
    const result = await categorySyncService.confirmLegacyMarvelMigration("1234");
    expect(result.status).toBe("already_completed");
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledOnce();
  });

  it("verifies remapped prerequisite relationships and all unique identities", () => {
    const first = legacyMovie();
    const second = legacyMovie({
      id: "legacy-2",
      tmdbId: 2,
      identityKey: "movie:2",
      title: "Avengers",
      baseTitle: "Avengers",
      prerequisiteIds: [first.id],
    });
    const snapshot = migrationSnapshot("done", [
      titleApi(first, { id: "TITLE-1" }),
      titleApi(second, { id: "TITLE-2", prerequisite_ids: ["TITLE-1"] }),
    ]);
    expect(verifyLegacyMigrationResponse(
      { status: "migrated", migrated_count: 2, snapshot },
      [first, second],
    )).toMatchObject({ legacyMarvelMigrationCompletedAt: "done" });
  });

  it.each([
    ["missing marker", { status: "migrated", migrated_count: 1, snapshot: migrationSnapshot(null, [titleApi(legacyMovie())]) }],
    ["missing identity", { status: "migrated", migrated_count: 1, snapshot: migrationSnapshot("done", []) }],
  ])("rejects an incomplete response: %s", async (_label, response) => {
    mocks.archive.writeAction.mockResolvedValue(response);
    await expect(categorySyncService.confirmLegacyMarvelMigration("1234")).rejects.toMatchObject({
      code: "migration_response_incomplete",
      stage: "verifying_migration",
    });
    expect(mocks.library.markLegacyBootstrapComplete).not.toHaveBeenCalled();
  });

  it("does not mark local bootstrap complete when the canonical cache transaction fails", async () => {
    mocks.archive.writeAction.mockResolvedValue({
      status: "migrated",
      migrated_count: 1,
      snapshot: migrationSnapshot("done", [titleApi(legacyMovie())]),
    });
    mocks.library.applyCanonicalSnapshot.mockRejectedValue(new Error("transaction aborted"));
    await expect(categorySyncService.confirmLegacyMarvelMigration("1234")).rejects.toMatchObject({
      code: "cache_write_failed",
      stage: "refreshing_cache",
    });
    expect(mocks.library.markLegacyBootstrapComplete).not.toHaveBeenCalled();
  });

  it("reports PIN, proxy action, and POST errors without modifying the cache", async () => {
    await expect(categorySyncService.confirmLegacyMarvelMigration("")).rejects.toMatchObject({ code: "pin_required" });

    mocks.archive.writeAction.mockRejectedValue(new Error("Invalid write action."));
    await expect(categorySyncService.confirmLegacyMarvelMigration("1234")).rejects.toMatchObject({
      code: "proxy_action_rejected",
    });
    expect(mocks.library.applyCanonicalSnapshot).not.toHaveBeenCalled();
    expect(mocks.library.markLegacyBootstrapComplete).not.toHaveBeenCalled();
  });
});

describe("categorized library sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.fetchData.mockResolvedValue(serverData("done"));
    mocks.player.getLegacyTitles.mockResolvedValue([]);
    mocks.library.readAll.mockResolvedValue(emptyState);
    mocks.library.hydrate.mockResolvedValue(emptyState);
    mocks.library.mergeServerSnapshot.mockResolvedValue(emptyState);
    mocks.library.applyCanonicalSnapshot.mockResolvedValue(emptyState);
  });

  it("pushes dirty records, applies id_map, and only completes the successful batch", async () => {
    const state = {
      categories: [{ id: "local-cat", name: "Noir", slug: "noir" }],
      titles: [{ id: "local-title", categoryId: "local-cat", tmdbId: 7, title: "Seven", baseTitle: "Seven", originalTitle: "Seven", type: "movie", identityKey: "movie:7", prerequisiteIds: [], isWatched: false }],
      outbox: [
        { id: "category:local-cat", kind: "category", recordId: "local-cat" },
        { id: "title:local-title", kind: "title", recordId: "local-title" },
      ],
    };
    mocks.library.readAll.mockResolvedValue(state);
    mocks.archive.writeAction.mockResolvedValue({
      snapshot: migrationSnapshot("done"),
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
    expect(result).toMatchObject({ pushed: 2, remaining: 0, migrationRequired: false });
  });

  it("still performs a no-store pull when the outbox is empty", async () => {
    const result = await categorySyncService.sync("1234");
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.archive.fetchData).toHaveBeenCalledOnce();
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ pushed: 0, pulled: 1, remaining: 0 });
  });

  it("keeps an icon cleanup in the outbox when that action fails", async () => {
    mocks.library.readAll.mockResolvedValue({
      categories: [],
      titles: [],
      outbox: [{ id: "iconCleanup:CAT", kind: "iconCleanup", recordId: "CAT", publicId: "old-icon" }],
    });
    mocks.archive.writeAction.mockRejectedValue(new Error("cleanup offline"));
    await expect(categorySyncService.sync("1234")).rejects.toThrow("cleanup offline");
    expect(mocks.library.completeOutboxOperation).not.toHaveBeenCalled();
  });

  it("does not clear library operations when their POST fails", async () => {
    mocks.library.readAll.mockResolvedValue({
      categories: [{ id: "CAT", name: "Noir", slug: "noir" }],
      titles: [],
      outbox: [{ id: "category:CAT", kind: "category", recordId: "CAT" }],
    });
    mocks.archive.writeAction.mockRejectedValue(new Error("offline"));
    await expect(categorySyncService.sync("1234")).rejects.toThrow("offline");
    expect(mocks.library.applyCanonicalSnapshot).not.toHaveBeenCalled();
    expect(mocks.library.completeOutboxOperation).not.toHaveBeenCalled();
  });

  it("reports a partial result when push succeeds but the verification pull fails", async () => {
    mocks.library.readAll.mockResolvedValue({
      categories: [{ id: "CAT", name: "Noir", slug: "noir" }],
      titles: [],
      outbox: [{ id: "category:CAT", kind: "category", recordId: "CAT" }],
    });
    mocks.archive.writeAction.mockResolvedValue({
      snapshot: migrationSnapshot("done"),
      id_map: {},
    });
    mocks.archive.fetchData.mockRejectedValue(new Error("verification offline"));

    await expect(categorySyncService.sync("1234")).rejects.toMatchObject({
      partial: true,
      summary: { pushed: 1 },
      code: "snapshot_request_failed",
    });
    expect(mocks.library.applyCanonicalSnapshot).toHaveBeenCalledWith(
      expect.any(Object),
      {},
      ["category:CAT"],
    );
  });

  it("background sync never prompts or migrates without an existing session PIN", async () => {
    mocks.archive.getSessionPin.mockReturnValue(null);
    await expect(categorySyncService.syncInBackground()).resolves.toEqual({ skipped: true });
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.archive.fetchData).not.toHaveBeenCalled();
    expect(mocks.player.getLegacyTitles).not.toHaveBeenCalled();
  });

  it("background sync with a PIN still leaves legacy migration pending for confirmation", async () => {
    mocks.archive.getSessionPin.mockReturnValue("1234");
    mocks.archive.fetchData.mockResolvedValue(serverData(null));
    mocks.player.getLegacyTitles.mockResolvedValue([legacyMovie()]);

    const result = await categorySyncService.syncInBackground();

    expect(result.migrationRequired).toBe(true);
    expect(result.pullResult.status).toBe("confirmation_required");
    expect(mocks.archive.writeAction).not.toHaveBeenCalled();
    expect(mocks.library.bootstrapLegacyMarvel).not.toHaveBeenCalled();
  });
});
