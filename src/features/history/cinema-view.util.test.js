import { describe, expect, it } from "vitest";
import { buildCinemaEntries, filterCinemaEntries } from "./cinema-view.util";

describe("Cinema archive view", () => {
  it("derives entries from the same movies and history snapshot", () => {
    const movies = [{ id: "movie-1", title: "Cached movie" }];
    const history = [{ id: "view-1", movie_id: "movie-1", watched_at: "2026-08-12", watched_in_theater: true }];
    expect(buildCinemaEntries(movies, history)).toEqual([
      expect.objectContaining({ id: "view-1", movie: movies[0] }),
    ]);
  });

  it("filters screenings by display title or original title", () => {
    const entries = [
      { id: "one", movie: { title: "Spirited Away", original_title: "千と千尋の神隠し" } },
      { id: "two", movie: { title: "Pengabdi Setan", original_title: "Pengabdi Setan" } },
    ];

    expect(filterCinemaEntries(entries, "spirited").map((entry) => entry.id)).toEqual(["one"]);
    expect(filterCinemaEntries(entries, "pengabdi").map((entry) => entry.id)).toEqual(["two"]);
    expect(filterCinemaEntries(entries, "  ")).toBe(entries);
  });
});
