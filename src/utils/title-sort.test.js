import { describe, expect, it } from "vitest";
import { sortTitles } from "./title-sort";

const movies = [
  { id: "alpha", title: "Alpha", release_date: "2020-01-01", runtime_minutes: 95 },
  { id: "zulu", title: "Zulu", release_date: "2024-01-01", runtime_minutes: 130 },
  { id: "unknown", title: "Unknown", release_date: null, runtime_minutes: null },
];

function ids(sortOption) {
  return sortTitles(movies, sortOption).map((movie) => movie.id);
}

describe("shared title sorting", () => {
  it("sorts movie records that use snake_case fields", () => {
    expect(ids("release-newest")).toEqual(["zulu", "alpha", "unknown"]);
    expect(ids("release-oldest")).toEqual(["alpha", "zulu", "unknown"]);
    expect(ids("duration-longest")).toEqual(["zulu", "alpha", "unknown"]);
    expect(ids("duration-shortest")).toEqual(["alpha", "zulu", "unknown"]);
  });

  it("sorts movie titles alphabetically in both directions", () => {
    expect(ids("title-ascending")).toEqual(["alpha", "unknown", "zulu"]);
    expect(ids("title-descending")).toEqual(["zulu", "unknown", "alpha"]);
  });
});
