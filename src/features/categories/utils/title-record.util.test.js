import { describe, expect, it } from "vitest";
import {
  assertUniqueCategoryIdentities,
  normalizeCategoryTitle,
  validateCategoryTitleRelationships,
} from "./title-record.util";

function movie(categoryId, tmdbId, title = `Movie ${tmdbId}`) {
  return normalizeCategoryTitle(categoryId, { tmdbId, type: "movie", title, baseTitle: title });
}

describe("category-scoped titles", () => {
  it("allows the same TMDB identity in different categories", () => {
    const marvel = movie("CAT-MARVEL", 1);
    const dc = movie("CAT-DC", 1);
    expect(() => assertUniqueCategoryIdentities([marvel, dc], [])).not.toThrow();
    expect(marvel.id).not.toBe(dc.id);
  });

  it("keeps watched state independent between categories", () => {
    const marvel = movie("CAT-MARVEL", 1);
    const dc = movie("CAT-DC", 1);
    const watchedMarvel = normalizeCategoryTitle(marvel.categoryId, { ...marvel, isWatched: true }, marvel);
    expect(watchedMarvel.isWatched).toBe(true);
    expect(dc.isWatched).toBe(false);
  });

  it("rejects cross-category prerequisites and cycles", () => {
    const marvel = { ...movie("CAT-MARVEL", 1), id: "marvel", prerequisiteIds: ["dc"] };
    const dc = { ...movie("CAT-DC", 2), id: "dc" };
    expect(() => validateCategoryTitleRelationships([marvel], [dc])).toThrow("same category");

    const first = { ...movie("CAT-MARVEL", 3), id: "first", prerequisiteIds: ["second"] };
    const second = { ...movie("CAT-MARVEL", 4), id: "second", prerequisiteIds: ["first"] };
    expect(() => validateCategoryTitleRelationships([first], [second])).toThrow("circular dependency");
  });
});
