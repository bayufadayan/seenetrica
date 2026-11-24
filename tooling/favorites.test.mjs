import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

function backend(records = [], movies = []) {
  const state = { records: structuredClone(records), writes: 0, uuid: 0, headers: [] };
  const api = new Function("state", "movies", `
    ${source}
    getSpreadsheet = () => ({ getSheetByName: () => ({}) });
    ensureSheetWithHeaders = (_name, headers) => { state.headers = headers; };
    readSheet = (name) => name === SHEET_NAMES.MOVIES ? movies : state.records;
    writeSheetRecords = (_name, records) => { state.records = records; state.writes++; };
    getRecordById = (_name, id) => movies.find(movie => movie.id === id);
    nowString = () => "2026-11-24T00:00:00Z";
    const LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
    const Utilities = { getUuid: () => "favorite-" + (++state.uuid) };
    return { updateFavorites };
  `)(state, movies);
  return { ...api, state };
}

describe("favorites persistence", () => {
  it("reorders one list without altering the other list", () => {
    const actor = { id: "actor", kind: "actor", item_id: "42", sort_order: 1 };
    const api = backend([
      { id: "one", kind: "movie", item_id: "MOV-1", sort_order: 1 },
      actor,
      { id: "two", kind: "movie", item_id: "MOV-2", sort_order: 2 },
    ]);
    api.updateFavorites({ kind: "movie", operation: "reorder", ids: ["two", "one"] });
    expect(api.state.records.filter(item => item.kind === "movie").map(item => [item.id, item.sort_order])).toEqual([["two", 1], ["one", 2]]);
    expect(api.state.records.find(item => item.id === "actor")).toEqual(actor);
  });

  it("rejects stale or incomplete ordering instead of dropping favorites", () => {
    const api = backend([{ id: "one", kind: "actor", item_id: "42" }, { id: "two", kind: "actor", item_id: "43" }]);
    expect(() => api.updateFavorites({ kind: "actor", operation: "reorder", ids: ["one"] })).toThrow("Refresh");
    expect(api.state.writes).toBe(0);
  });

  it("deduplicates exact movie records while allowing separate seasons", () => {
    const api = backend([], [{ id: "season-1", title: "Show · Season 1" }, { id: "season-2", title: "Show · Season 2" }]);
    api.updateFavorites({ kind: "movie", operation: "add", item_id: "season-1" });
    api.updateFavorites({ kind: "movie", operation: "add", item_id: "season-1" });
    api.updateFavorites({ kind: "movie", operation: "add", item_id: "season-2" });
    expect(api.state.records.map(item => item.item_id)).toEqual(["season-1", "season-2"]);
  });

  it("preserves legacy favorites and gives franchises a position in the same list", () => {
    const legacy = { id: "old", kind: "movie", item_id: "MOV-1", name: 1917, sort_order: 1 };
    const api = backend([legacy]);
    api.updateFavorites({ kind: "movie", operation: "create_franchise", name: "Hunger Games" });
    expect(api.state.records[0]).toEqual(legacy);
    expect(api.state.records[1]).toMatchObject({ entry_type: "franchise", name: "Hunger Games", sort_order: 2, parent_id: "" });
    expect(api.state.headers).toContain("parent_id");
  });

  it("copies titles in order into a folder without disturbing top level ranks or another folder", () => {
    const root = { id: "root", kind: "movie", item_id: "s1", sort_order: 1 };
    const folder = { id: "folder", kind: "movie", entry_type: "franchise", sort_order: 2 };
    const other = { id: "other", kind: "movie", parent_id: "another-folder", item_id: "s2", sort_order: 1 };
    const api = backend([root, folder, other], [{ id: "s1", title: 1917 }, { id: "s2", title: "Season 2" }]);
    api.updateFavorites({ kind: "movie", parent_id: "folder", operation: "add_movies", movie_ids: ["s2", "s1", "s2"] });
    expect(api.state.records.filter(item => item.parent_id === "folder").map(item => [item.item_id, item.sort_order])).toEqual([["s2", 1], ["s1", 2]]);
    expect(api.state.records.filter(item => item.parent_id === "folder")[1].name).toBe("1917");
    expect(api.state.records).toContainEqual(root);
    expect(api.state.records).toContainEqual(other);
    expect(api.state.records.filter(item => item.parent_id === "folder").map(item => item.id)).toEqual(["favorite-1", "favorite-2"]);
  });

  it("rejects copying a missing title atomically and prevents nested franchises", () => {
    const api = backend([{ id: "folder", kind: "movie", entry_type: "franchise" }], [{ id: "s1", title: "Season 1" }]);
    expect(() => api.updateFavorites({ kind: "movie", parent_id: "folder", operation: "add_movies", movie_ids: ["s1", "missing"] })).toThrow("Sync");
    expect(api.state.writes).toBe(0);
    expect(() => api.updateFavorites({ kind: "movie", parent_id: "folder", operation: "create_franchise", name: "Nested" })).toThrow("main");
  });

  it("reorders folder contents independently and deletes only the removed folder's children", () => {
    const root = { id: "root", kind: "movie", item_id: "s1", sort_order: 1 };
    const records = [root, { id: "folder", kind: "movie", entry_type: "franchise", sort_order: 2 },
      { id: "a", kind: "movie", parent_id: "folder", item_id: "s1", sort_order: 1 },
      { id: "b", kind: "movie", parent_id: "folder", item_id: "s2", sort_order: 2 }];
    const api = backend(records);
    api.updateFavorites({ kind: "movie", parent_id: "folder", operation: "reorder", ids: ["b", "a"] });
    expect(api.state.records.filter(item => item.parent_id === "folder").map(item => item.item_id)).toEqual(["s2", "s1"]);
    api.updateFavorites({ kind: "movie", operation: "remove", id: "folder" });
    expect(api.state.records).toEqual([root]);
  });
});
