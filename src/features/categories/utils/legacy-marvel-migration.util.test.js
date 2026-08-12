import { describe, expect, it } from "vitest";
import {
  chunkLegacyMarvelTitles,
  prepareLegacyMarvelDataset,
} from "./legacy-marvel-migration.util";

function movie(id, tmdbId, title, prerequisiteIds = []) {
  return {
    id,
    tmdbId,
    title,
    baseTitle: title,
    originalTitle: title,
    type: "movie",
    identityKey: `movie:${tmdbId}`,
    prerequisiteIds,
    isWatched: false,
  };
}

describe("legacy Marvel migration dataset", () => {
  it("creates sequential batch shapes of 10, 10, and 3", () => {
    const records = Array.from({ length: 23 }, (_, index) => movie(`id-${index}`, index + 1, `Movie ${index + 1}`));
    expect(chunkLegacyMarvelTitles(records).map((batch) => batch.length)).toEqual([10, 10, 3]);
  });

  it("sorts prerequisites before dependents even when IndexedDB order is reversed", () => {
    const prerequisite = movie("first", 1, "Iron Man");
    const dependent = movie("second", 2, "Avengers", [prerequisite.id]);
    expect(prepareLegacyMarvelDataset([dependent, prerequisite]).map((record) => record.id))
      .toEqual(["first", "second"]);
  });

  it("deduplicates identityKey deterministically and remaps prerequisite aliases", () => {
    const firstCopy = movie("a-copy", 1, "Iron Man Copy");
    const selected = movie("a", 1, "Iron Man");
    const dependent = movie("b", 2, "Avengers", [firstCopy.id]);
    const prepared = prepareLegacyMarvelDataset([dependent, firstCopy, selected]);
    expect(prepared).toHaveLength(2);
    expect(prepared[0].id).toBe("a");
    expect(prepared[1].prerequisiteIds).toEqual(["a"]);
  });

  it("rejects a missing prerequisite before upload and names the affected title", () => {
    expect(() => prepareLegacyMarvelDataset([
      movie("dependent", 2, "Avengers", ["missing"]),
    ])).toThrow("Avengers references a missing prerequisite");
  });

  it("rejects a cycle before upload and names the affected titles", () => {
    expect(() => prepareLegacyMarvelDataset([
      movie("one", 1, "Iron Man", ["two"]),
      movie("two", 2, "Avengers", ["one"]),
    ])).toThrow(/Circular prerequisites found for:.*(Iron Man|Avengers)/);
  });

});
