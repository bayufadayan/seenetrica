import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const backend = new Function(
  `${source}; return { categoryMovieForClient, normalizeMovieInput, validateCategoryMovieRelationships, findCanonicalMovie, upsertMovieInRecords };`,
)();

describe("Apps Script category movie schema", () => {
  it("accepts unlisted movies and keeps canonical title metadata", () => {
    expect(backend.normalizeMovieInput({
      external_source: "tmdb",
      external_id: 42,
      title: "Display title",
      original_title: "Original title",
      media_type: "movie",
      status: "unlisted",
    })).toMatchObject({
      external_id: 42,
      title: "Display title",
      original_title: "Original title",
      identity_key: "movie:42",
      status: "unlisted",
    });
  });

  it("maps prerequisite movie IDs back to category membership IDs", () => {
    const title = backend.categoryMovieForClient(
      {
        id: "LINK-2",
        category_id: "CAT",
        movie_id: "MOV-2",
        is_watched: false,
        prerequisite_movie_ids: JSON.stringify(["MOV-1"]),
      },
      {
        id: "MOV-2",
        external_id: 2,
        title: "Second",
        media_type: "movie",
        identity_key: "movie:2",
      },
      new Map([["MOV-1", "LINK-1"], ["MOV-2", "LINK-2"]]),
    );

    expect(title.prerequisite_ids).toEqual(["LINK-1"]);
  });

  it("rejects prerequisite IDs that are outside the category", () => {
    expect(() => backend.validateCategoryMovieRelationships(
      [{
        id: "LINK-2",
        category_id: "CAT",
        movie_id: "MOV-2",
        prerequisite_movie_ids: JSON.stringify(["MOV-MISSING"]),
      }],
      [{ id: "CAT", deleted_at: null }],
    )).toThrow("same category");
  });
});



describe("Apps Script movie identity and safe creation", () => {
  const stored = {
    id: "MOV-SAVED",
    external_source: "tmdb",
    external_id: 70523,
    media_type: "series",
    season_number: 2,
    identity_key: "series:70523:season:2",
    status: "watched",
    rating: 9,
    review: "Keep my original review",
  };

  it("reuses an existing season instead of another season of the same show", () => {
    expect(backend.findCanonicalMovie([stored], { ...stored, id: "new" })?.id).toBe("MOV-SAVED");
    expect(backend.findCanonicalMovie([stored], { ...stored, season_number: 1, identity_key: "series:70523:season:1" })).toBeNull();
  });

  it("does not overwrite an existing movie on a repeated Add Movie", () => {
    const movies = [{ ...stored }];
    const result = backend.upsertMovieInRecords(movies, { ...stored, rating: null, review: null, status: "watchlist" }, "2026-10-17");
    expect(result.created).toBe(false);
    expect(result.movie).toMatchObject({ id: "MOV-SAVED", rating: 9, review: "Keep my original review", status: "watched" });
    expect(movies).toEqual([stored]);
  });
});
