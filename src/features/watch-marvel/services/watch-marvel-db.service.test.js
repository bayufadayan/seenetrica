import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const state = { data: [] };
  const database = {
    getAll: async () => [...state.data],
    transaction() {
      let aborted = false;
      const staged = state.data.map((record) => ({ ...record }));
      const store = {
        getAll: async () => [...staged],
        add: async (record) => {
          if (record.title === "Force transaction failure") throw new Error("Simulated IndexedDB failure.");
          if (staged.some((item) => item.id === record.id)) throw new Error("Duplicate key.");
          staged.push(record);
        },
        put: async (record) => {
          const index = staged.findIndex((item) => item.id === record.id);
          if (index >= 0) staged[index] = record;
          else staged.push(record);
        },
        delete: async (id) => {
          const index = staged.findIndex((item) => item.id === id);
          if (index >= 0) staged.splice(index, 1);
        },
      };
      return {
        store,
        abort() { aborted = true; },
        get done() {
          return Promise.resolve().then(() => {
            if (!aborted) state.data = staged;
          });
        },
      };
    },
  };
  return { state, database };
});

vi.mock("idb", () => ({ openDB: vi.fn(async () => mock.database) }));

import {
  normalizeTitlePayload,
  validateTitleRelationships,
  watchMarvelDb,
} from "./watch-marvel-db.service";

function movie(tmdbId, title = `Movie ${tmdbId}`, prerequisiteIds = []) {
  return { tmdbId, type: "movie", title, baseTitle: title, prerequisiteIds };
}

describe("Marvel prerequisite validation", () => {
  it("accepts optional prerequisites and normalizes duplicate IDs for movies and seasons", () => {
    expect(normalizeTitlePayload(movie(1)).prerequisiteIds).toEqual([]);
    expect(normalizeTitlePayload(movie(2, "Movie", ["saved", "saved"])).prerequisiteIds).toEqual(["saved"]);
    const season = normalizeTitlePayload({ tmdbId: 3, type: "series", title: "Series S1", baseTitle: "Series", seasonNumber: 1, prerequisiteIds: ["saved"] });
    expect(season.prerequisiteIds).toEqual(["saved"]);
    expect(season.identityKey).toBe("series:3:season:1");
  });
  it("requires saved prerequisites and rejects self references", () => {
    const record = { ...normalizeTitlePayload(movie(1)), prerequisiteIds: ["missing"] };
    expect(() => validateTitleRelationships([record], [])).toThrow("no longer exist");
    expect(() => validateTitleRelationships([{ ...record, prerequisiteIds: [record.id] }], [])).toThrow("cannot require itself");
  });
  it("rejects circular dependencies for every record type", () => {
    const updated = { ...normalizeTitlePayload(movie(1)), id: "a", prerequisiteIds: ["b"] };
    const existing = [{ ...normalizeTitlePayload({ tmdbId: 2, type: "series", title: "Series", baseTitle: "Series" }), id: "b", prerequisiteIds: ["a"] }];
    expect(() => validateTitleRelationships([updated], existing)).toThrow("circular dependency");
  });
});

describe("Marvel atomic bulk creation", () => {
  beforeEach(() => { mock.state.data = []; });

  it("rejects an empty batch", async () => {
    await expect(watchMarvelDb.createTitles([])).rejects.toThrow("at least one title");
  });
  it("rejects duplicate identities within a batch", async () => {
    await expect(watchMarvelDb.createTitles([movie(1, "First"), movie(1, "Duplicate")])).rejects.toThrow("more than once");
    expect(mock.state.data).toHaveLength(0);
  });
  it("rejects a title already in the library", async () => {
    mock.state.data = [normalizeTitlePayload(movie(1, "Existing"))];
    await expect(watchMarvelDb.createTitles([movie(1, "Existing")])).rejects.toThrow("already in the Marvel library");
    expect(mock.state.data).toHaveLength(1);
  });
  it("saves every valid title in one batch", async () => {
    const saved = await watchMarvelDb.createTitles([movie(1), movie(2)]);
    expect(saved).toHaveLength(2);
    expect(mock.state.data).toHaveLength(2);
  });
  it("does not commit part of a failed batch", async () => {
    await expect(watchMarvelDb.createTitles([movie(1), movie(2, "Force transaction failure")])).rejects.toThrow("Simulated IndexedDB failure");
    expect(mock.state.data).toHaveLength(0);
  });
});
