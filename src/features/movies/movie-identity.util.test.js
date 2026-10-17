import { describe, expect, it } from "vitest";
import { findMoviesByIdentity, findMoviesWithSameTitle } from "./movie-identity.util";

const movies = [
  { id: "a", title: "Dune", external_source: "tmdb", external_id: 438631, media_type: "movie" },
  { id: "b", title: "Dune", external_source: "tmdb", external_id: 841, media_type: "movie" },
  { id: "c", title: "Dark", external_source: "tmdb", external_id: 70523, media_type: "series", season_number: 1 },
  { id: "d", title: "Dark", external_source: "tmdb", external_id: 70523, media_type: "series", season_number: 2 },
];

describe("movie identity lookup", () => {
  it("matches TMDB identity, not just the title", () => {
    expect(findMoviesByIdentity(movies, { external_source: "tmdb", external_id: 438631, media_type: "movie" }).map((movie) => movie.id)).toEqual(["a"]);
  });
  it("distinguishes seasons of the same series", () => {
    expect(findMoviesByIdentity(movies, { external_source: "tmdb", external_id: 70523, media_type: "series", season_number: 2 }).map((movie) => movie.id)).toEqual(["d"]);
  });
  it("does not treat manual entries as certain matches", () => {
    expect(findMoviesByIdentity(movies, { external_source: "manual", title: "Dune" })).toEqual([]);
  });
  it("warns about matching names without merging distinct releases", () => {
    expect(findMoviesWithSameTitle(movies, "  DUNE  ").map((movie) => movie.id)).toEqual(["a", "b"]);
  });
});
