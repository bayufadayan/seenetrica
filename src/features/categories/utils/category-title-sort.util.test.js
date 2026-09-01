import { describe, expect, it } from "vitest";
import { sortCategoryTitles } from "./category-title-sort.util";

const titles = [
  {
    id: "alpha",
    title: "Alpha",
    releaseDate: "2020-04-10",
    runtimeMinutes: 100,
  },
  {
    id: "zulu",
    title: "Zulu",
    releaseDate: "2024-02-15",
    runtimeMinutes: 120,
  },
  {
    id: "bravo",
    title: "Bravo",
    releaseDate: null,
    runtimeMinutes: null,
  },
  {
    id: "echo",
    title: "Echo",
    releaseDate: "2018-11-20",
    runtimeMinutes: 90,
  },
];

function sortedIds(sortOption) {
  return sortCategoryTitles(titles, sortOption).map((title) => title.id);
}

describe("category title sorting", () => {
  it("sorts release years in both directions with missing dates last", () => {
    expect(sortedIds("release-newest")).toEqual([
      "zulu",
      "alpha",
      "echo",
      "bravo",
    ]);
    expect(sortedIds("release-oldest")).toEqual([
      "echo",
      "alpha",
      "zulu",
      "bravo",
    ]);
  });

  it("sorts titles alphabetically in both directions", () => {
    expect(sortedIds("title-ascending")).toEqual([
      "alpha",
      "bravo",
      "echo",
      "zulu",
    ]);
    expect(sortedIds("title-descending")).toEqual([
      "zulu",
      "echo",
      "bravo",
      "alpha",
    ]);
  });

  it("sorts durations in both directions with unknown durations last", () => {
    expect(sortedIds("duration-longest")).toEqual([
      "zulu",
      "alpha",
      "echo",
      "bravo",
    ]);
    expect(sortedIds("duration-shortest")).toEqual([
      "echo",
      "alpha",
      "zulu",
      "bravo",
    ]);
  });

  it("does not mutate the original library order", () => {
    const originalOrder = titles.map((title) => title.id);
    sortCategoryTitles(titles, "title-descending");
    expect(titles.map((title) => title.id)).toEqual(originalOrder);
  });
});
