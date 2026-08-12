import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archive: { fetchCategorizedData: vi.fn(), writeAction: vi.fn() },
  player: { hasLegacyTitles: vi.fn(), getLegacyTitles: vi.fn(), clearLegacyTitles: vi.fn() },
  library: { replaceMarvelFromServer: vi.fn(), mergeServerSnapshot: vi.fn() },
}));

vi.mock("../../../services/archive.service", () => ({ archiveService: mocks.archive }));
vi.mock("../../player/services/player-db.service", () => ({ playerDb: mocks.player }));
vi.mock("./category-library-db.service", () => ({ categoryLibraryDb: mocks.library }));

import { legacyMarvelDataService } from "./legacy-marvel-data.service";

function legacyMovie(index, prerequisiteIds = []) {
  return {
    id: `legacy-${index}`,
    tmdbId: index,
    title: `Movie ${index}`,
    baseTitle: `Movie ${index}`,
    originalTitle: `Movie ${index}`,
    type: "movie",
    identityKey: `movie:${index}`,
    prerequisiteIds,
    isWatched: false,
  };
}

function apiTitle(source, overrides = {}) {
  return {
    id: source.id,
    category_id: "CAT-MARVEL",
    tmdb_id: source.tmdbId,
    title: source.title,
    base_title: source.baseTitle,
    original_title: source.originalTitle,
    media_type: source.type,
    identity_key: source.identityKey,
    prerequisite_ids: source.prerequisiteIds || [],
    is_watched: source.isWatched,
    ...overrides,
  };
}

function serverData(titles = []) {
  return {
    categories: [{ id: "CAT-MARVEL", name: "Marvel", slug: "marvel" }],
    category_titles: titles,
    category_sync: { server_time: "2026-08-12T12:00:00.000Z" },
  };
}

function installSuccessfulServer(initialTitles = []) {
  const serverTitles = [...initialTitles];
  let activeRequests = 0;
  let maximumActive = 0;
  mocks.archive.fetchCategorizedData.mockImplementation(async () => serverData(serverTitles));
  mocks.archive.writeAction.mockImplementation(async (_action, data) => {
    activeRequests += 1;
    maximumActive = Math.max(maximumActive, activeRequests);
    await Promise.resolve();
    const idMap = {};
    for (const record of data.category_titles) {
      const serverId = `server-${record.id}`;
      idMap[record.id] = serverId;
      serverTitles.push({ ...record, id: serverId });
    }
    activeRequests -= 1;
    return {
      snapshot: serverData(serverTitles),
      id_map: { category_titles: idMap },
    };
  });
  return { serverTitles, getMaximumActive: () => maximumActive };
}

describe("legacy Marvel data actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.player.hasLegacyTitles.mockResolvedValue(true);
    mocks.library.replaceMarvelFromServer.mockResolvedValue({ categories: [], titles: [], outbox: [] });
    mocks.library.mergeServerSnapshot.mockResolvedValue({ categories: [], titles: [], outbox: [] });
  });

  it("skips identities already present in the Spreadsheet", async () => {
    const existing = legacyMovie(1);
    const missing = legacyMovie(2);
    mocks.player.getLegacyTitles.mockResolvedValue([existing, missing]);
    installSuccessfulServer([apiTitle(existing, { id: "SERVER-EXISTING" })]);

    const result = await legacyMarvelDataService.migrate("1234");

    expect(mocks.archive.writeAction).toHaveBeenCalledOnce();
    expect(mocks.archive.writeAction.mock.calls[0][1].category_titles)
      .toEqual([expect.objectContaining({ identity_key: "movie:2" })]);
    expect(result).toMatchObject({ migrated: 1, skipped: 1, total: 2 });
    expect(mocks.player.clearLegacyTitles).toHaveBeenCalledOnce();
  });

  it("sends 25 titles sequentially in batches of 10, 10, and 5", async () => {
    const legacy = Array.from({ length: 25 }, (_, index) => legacyMovie(index + 1));
    mocks.player.getLegacyTitles.mockResolvedValue(legacy);
    const server = installSuccessfulServer();
    const progress = [];

    await legacyMarvelDataService.migrate("1234", { onProgress: (value) => progress.push(value) });

    expect(mocks.archive.writeAction.mock.calls.map((call) => call[1].category_titles.length))
      .toEqual([10, 10, 5]);
    expect(server.getMaximumActive()).toBe(1);
    expect(progress).toContainEqual(expect.objectContaining({ stage: "migrating", completed: 25, total: 25 }));
  });

  it("does not clear legacy data when the second batch fails", async () => {
    const legacy = Array.from({ length: 15 }, (_, index) => legacyMovie(index + 1));
    const serverTitles = [];
    mocks.player.getLegacyTitles.mockResolvedValue(legacy);
    mocks.archive.fetchCategorizedData.mockImplementation(async () => serverData(serverTitles));
    mocks.archive.writeAction
      .mockImplementationOnce(async (_action, data) => {
        serverTitles.push(...data.category_titles);
        return { snapshot: serverData(serverTitles), id_map: { category_titles: {} } };
      })
      .mockRejectedValueOnce(new Error("network failed"));

    await expect(legacyMarvelDataService.migrate("1234")).rejects.toThrow("network failed");
    expect(mocks.player.clearLegacyTitles).not.toHaveBeenCalled();
    expect(mocks.library.mergeServerSnapshot).not.toHaveBeenCalled();
  });

  it("retry rechecks the Spreadsheet and does not resend the successful first batch", async () => {
    const legacy = Array.from({ length: 15 }, (_, index) => legacyMovie(index + 1));
    const serverTitles = [];
    let request = 0;
    mocks.player.getLegacyTitles.mockResolvedValue(legacy);
    mocks.archive.fetchCategorizedData.mockImplementation(async () => serverData(serverTitles));
    mocks.archive.writeAction.mockImplementation(async (_action, data) => {
      request += 1;
      if (request === 2) throw new Error("network failed");
      serverTitles.push(...data.category_titles);
      return { snapshot: serverData(serverTitles), id_map: { category_titles: {} } };
    });

    await expect(legacyMarvelDataService.migrate("1234")).rejects.toThrow("network failed");
    await legacyMarvelDataService.migrate("1234");

    expect(mocks.archive.writeAction.mock.calls.map((call) => call[1].category_titles.length))
      .toEqual([10, 5, 5]);
    const sentIdentities = mocks.archive.writeAction.mock.calls.flatMap((call) =>
      call[1].category_titles.map((title) => title.identity_key),
    );
    expect(sentIdentities.filter((identity) => identity === "movie:1")).toHaveLength(1);
    expect(mocks.player.clearLegacyTitles).toHaveBeenCalledOnce();
  });

  it("remaps an existing prerequisite to its Spreadsheet ID", async () => {
    const prerequisite = legacyMovie(1);
    const dependent = legacyMovie(2, [prerequisite.id]);
    mocks.player.getLegacyTitles.mockResolvedValue([dependent, prerequisite]);
    installSuccessfulServer([apiTitle(prerequisite, { id: "SERVER-PREREQUISITE" })]);

    await legacyMarvelDataService.migrate("1234");

    expect(mocks.archive.writeAction.mock.calls[0][1].category_titles[0].prerequisite_ids)
      .toEqual(["SERVER-PREREQUISITE"]);
  });

  it("does not clear legacy data when the final migration cache write fails", async () => {
    mocks.player.getLegacyTitles.mockResolvedValue([legacyMovie(1)]);
    installSuccessfulServer();
    mocks.library.mergeServerSnapshot.mockRejectedValue(new Error("cache failed"));
    await expect(legacyMarvelDataService.migrate("1234")).rejects.toThrow("cache failed");
    expect(mocks.player.clearLegacyTitles).not.toHaveBeenCalled();
  });

  it("does not clear legacy data when the refreshed Spreadsheet fails verification", async () => {
    const source = legacyMovie(1);
    mocks.player.getLegacyTitles.mockResolvedValue([source]);
    mocks.archive.fetchCategorizedData
      .mockResolvedValueOnce(serverData())
      .mockResolvedValueOnce(serverData());
    mocks.archive.writeAction.mockResolvedValue({
      snapshot: serverData([apiTitle(source)]),
      id_map: { category_titles: {} },
    });

    await expect(legacyMarvelDataService.migrate("1234"))
      .rejects.toThrow("refreshed Spreadsheet is missing Movie 1");
    expect(mocks.player.clearLegacyTitles).not.toHaveBeenCalled();
  });

  it("synchronizes in fetch, cache, then clear order", async () => {
    mocks.archive.fetchCategorizedData.mockResolvedValue(serverData([apiTitle(legacyMovie(1))]));
    await legacyMarvelDataService.synchronize();
    expect(mocks.archive.fetchCategorizedData.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.library.replaceMarvelFromServer.mock.invocationCallOrder[0]);
    expect(mocks.library.replaceMarvelFromServer.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.player.clearLegacyTitles.mock.invocationCallOrder[0]);
  });

  it.each([
    ["fetch", () => mocks.archive.fetchCategorizedData.mockRejectedValue(new Error("offline"))],
    ["cache", () => {
      mocks.archive.fetchCategorizedData.mockResolvedValue(serverData());
      mocks.library.replaceMarvelFromServer.mockRejectedValue(new Error("cache failed"));
    }],
  ])("does not clear legacy data when synchronize %s fails", async (_label, arrange) => {
    arrange();
    await expect(legacyMarvelDataService.synchronize()).rejects.toThrow();
    expect(mocks.player.clearLegacyTitles).not.toHaveBeenCalled();
  });
});
