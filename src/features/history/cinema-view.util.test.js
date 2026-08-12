import { describe, expect, it } from "vitest";
import { buildCinemaEntries } from "./cinema-view.util";

describe("Cinema archive view", () => {
  it("derives entries from the same movies and history snapshot", () => {
    const movies = [{ id: "movie-1", title: "Cached movie" }];
    const history = [{ id: "view-1", movie_id: "movie-1", watched_at: "2026-08-12", watched_in_theater: true }];
    expect(buildCinemaEntries(movies, history)).toEqual([
      expect.objectContaining({ id: "view-1", movie: movies[0] }),
    ]);
  });
});
