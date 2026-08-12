import { describe, expect, it } from "vitest";
import {
  createMovieDraft,
  createSeasonDrafts,
  createTitleIdentityKey,
  createWholeSeriesDraft,
  normalizeLegacyTitle,
} from "./title-draft.util";

const details = {
  external_id: 61889,
  title: "Daredevil",
  original_title: "Daredevil",
  release_date: "2015-04-10",
  poster_path: "/series.jpg",
  backdrop_path: "/backdrop.jpg",
  runtime_minutes: 52,
  seasons: [
    { id: 1, season_number: 0, air_date: "2014-01-01", poster_path: "/special.jpg" },
    { id: 2, season_number: 1, air_date: "2015-04-10", poster_path: "/s1.jpg" },
    { id: 3, season_number: 2, air_date: "2016-03-18", poster_path: null },
    { id: 4, season_number: 3, air_date: "2018-10-19", poster_path: "/s3.jpg" },
  ],
};

describe("category title identity", () => {
  it("builds movie, whole-series, and season identities", () => {
    expect(createTitleIdentityKey({ type: "movie", tmdbId: 1726 })).toBe("movie:1726");
    expect(createTitleIdentityKey({ type: "series", tmdbId: 61889 })).toBe("series:61889:whole");
    expect(createTitleIdentityKey({ type: "series", tmdbId: 61889, seasonNumber: 1 })).toBe("series:61889:season:1");
  });
  it("adds identities to movie and whole-series drafts", () => {
    expect(createMovieDraft({ ...details, external_id: 1726 }).identityKey).toBe("movie:1726");
    expect(createWholeSeriesDraft(details).identityKey).toBe("series:61889:whole");
  });
});

describe("category season drafts", () => {
  it("creates S1 through S3 without specials", () => {
    const drafts = createSeasonDrafts(details, 1, 3);
    expect(drafts.map((draft) => draft.title)).toEqual(["Daredevil S1", "Daredevil S2", "Daredevil S3"]);
    expect(drafts.map((draft) => draft.seasonNumber)).toEqual([1, 2, 3]);
  });
  it("uses season artwork and dates with series fallbacks", () => {
    const [first, second] = createSeasonDrafts(details, 1, 2);
    expect(first.posterPath).toBe("/s1.jpg");
    expect(second.posterPath).toBe("/series.jpg");
    expect(second.backdropPath).toBe("/backdrop.jpg");
    expect(second.releaseDate).toBe("2016-03-18");
  });
  it("deduplicates TMDB season data and rejects invalid ranges", () => {
    const duplicate = { ...details, seasons: [...details.seasons, details.seasons[1]] };
    expect(createSeasonDrafts(duplicate, 1, 1)).toHaveLength(1);
    expect(() => createSeasonDrafts(details, 3, 1)).toThrow("valid season range");
    expect(() => createSeasonDrafts(details, 1, 4)).toThrow("greater than 3");
  });
});

describe("legacy Marvel title migration", () => {
  it("normalizes a movie without losing watched or prerequisites", () => {
    const migrated = normalizeLegacyTitle({ id: "old", tmdbId: 1726, type: "movie", title: "Iron Man", isWatched: true, prerequisiteIds: ["one"] });
    expect(migrated).toMatchObject({ id: "old", baseTitle: "Iron Man", seasonNumber: null, seasonTmdbId: null, identityKey: "movie:1726", isWatched: true, prerequisiteIds: ["one"] });
  });
  it("keeps a legacy series as a whole-series record", () => {
    expect(normalizeLegacyTitle({ id: "old", tmdbId: 61889, type: "series", title: "Daredevil" }).identityKey).toBe("series:61889:whole");
  });
});
