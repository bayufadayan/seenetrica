import { describe, expect, it } from "vitest";
import localization from "../../lib/tmdb-localization.js";

const {
  chooseLocalizedItem,
  displayTitle,
  isIndonesianProduction,
  mergeLocalizedSearchResults,
} = localization;

describe("TMDB localization", () => {
  it("detects Indonesian productions from language or country", () => {
    expect(isIndonesianProduction({ original_language: "id" })).toBe(true);
    expect(isIndonesianProduction({ production_countries: [{ iso_3166_1: "ID" }] })).toBe(true);
    expect(isIndonesianProduction({ original_language: "ko", origin_country: ["KR"] })).toBe(false);
  });

  it("uses Indonesian metadata only for Indonesian productions", () => {
    const english = {
      id: 1,
      media_type: "movie",
      title: "English title",
      original_title: "Judul Asli",
      original_language: "id",
      poster_path: "/english.jpg",
    };
    const indonesian = {
      ...english,
      title: "Judul Indonesia",
      poster_path: "/indonesia.jpg",
    };

    const result = chooseLocalizedItem(english, indonesian);
    expect(result.poster_path).toBe("/indonesia.jpg");
    expect(displayTitle(result)).toBe("Judul Asli");
  });

  it("keeps English metadata for non-Indonesian productions", () => {
    const english = {
      id: 2,
      media_type: "movie",
      title: "English title",
      original_language: "ja",
      origin_country: ["JP"],
      poster_path: "/english.jpg",
    };
    const indonesian = {
      ...english,
      title: "Judul terjemahan",
      poster_path: "/indonesia.jpg",
    };

    expect(chooseLocalizedItem(english, indonesian)).toEqual(english);
  });

  it("merges language searches without duplicate TMDB entries", () => {
    const english = [{ id: 3, media_type: "tv", name: "Series", original_language: "en" }];
    const indonesian = [
      { id: 3, media_type: "tv", name: "Serial", original_language: "en" },
      { id: 4, media_type: "movie", title: "Film", original_language: "id" },
    ];

    expect(mergeLocalizedSearchResults(english, indonesian).map((item) => item.id)).toEqual([3, 4]);
  });
});
