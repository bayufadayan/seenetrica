import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const backend = new Function(
  `${source}; return { categoryMovieForClient, normalizeMovieInput, validateCategoryMovieRelationships };`,
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
