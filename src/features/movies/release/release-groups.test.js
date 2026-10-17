import { describe, expect, it } from "vitest";
import { formatReleaseDay, groupMoviesByReleaseMonth, validReleaseDate } from "./release-groups";

const movies = [
  { id: "b", title: "Bravo", release_date: "2026-10-21" },
  { id: "tba", title: "No date", release_date: null },
  { id: "old", title: "Early", release_date: "2025-01-02" },
  { id: "a", title: "Alpha", release_date: "2026-10-03" },
  { id: "same", title: "Another", release_date: "2026-10-03" },
  { id: "invalid", title: "Invalid", release_date: "2026-02-30" },
];

describe("release month groups", () => {
  it("groups chronologically, with TBA at the end", () => {
    const groups = groupMoviesByReleaseMonth(movies, new Date(2026, 9, 17));
    expect(groups.map((group) => group.key)).toEqual(["2025-01", "2026-10", "tba"]);
    expect(groups[1].movies.map((movie) => movie.id)).toEqual(["a", "same", "b"]);
    expect(groups[2].movies.map((movie) => movie.id)).toEqual(["invalid", "tba"]);
    expect(groups[1].isCurrentMonth).toBe(true);
    expect(groups[0].isCurrentMonth).toBe(false);
  });

  it("validates calendar dates and formats timeline labels", () => {
    expect(validReleaseDate("2026-02-30")).toBeNull();
    expect(validReleaseDate("2028-02-29")).toBe("2028-02-29");
    expect(formatReleaseDay("2026-10-17")).toBe("Oct 17");
    expect(formatReleaseDay(null)).toBe("Date TBA");
  });
});
