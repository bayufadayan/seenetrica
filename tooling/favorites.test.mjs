import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

function backend(records = [], movies = []) {
  const state = { records: structuredClone(records), writes: 0 };
  const api = new Function("state", "movies", `
    ${source}
    getSpreadsheet = () => ({ getSheetByName: () => ({}) });
    readSheet = () => state.records;
    writeSheetRecords = (_name, records) => { state.records = records; state.writes++; };
    getRecordById = (_name, id) => movies.find(movie => movie.id === id);
    nowString = () => "2026-11-24T00:00:00Z";
    const LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
    const Utilities = { getUuid: () => "favorite-" + state.writes };
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
});
