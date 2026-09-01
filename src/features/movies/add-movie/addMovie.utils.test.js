import { describe, expect, it } from "vitest";
import {
  createBatchPayload,
  createMovieDetailsPath,
  createMoviePayload,
  createViewingPayload,
  getLastDateOfMonth,
  getLaunchPreset,
} from "./addMovie.utils";

const movieForm = {
  title: "  Arrival  ",
  original_title: "  Arrival  ",
  poster_url: "  https://example.com/poster.jpg  ",
  release_date: "2016-11-11",
  media_type: "movie",
  runtime_minutes: "116",
  status: "watched",
  rating: "9.5",
  review: "  Thoughtful science fiction.  ",
  watched_at: "2026-08-12",
  watched_in_theater: true,
};

describe("add movie launch preset", () => {
  it("uses valid query parameters", () => {
    const params = new URLSearchParams({
      status: "plan",
      theater: "true",
      period: "2026-08",
      watched_at: "2026-08-12",
    });

    expect(getLaunchPreset(params)).toEqual({
      status: "plan",
      inTheater: true,
      period: "2026-08",
      watchedAt: "2026-08-12",
    });
  });

  it("falls back safely when query parameters are invalid", () => {
    const params = new URLSearchParams({
      status: "unknown",
      period: "August",
      watched_at: "tomorrow",
    });

    expect(getLaunchPreset(params)).toEqual({
      status: "watchlist",
      inTheater: false,
      period: "",
      watchedAt: "",
    });
  });
});

describe("add movie payloads", () => {
  it("normalizes a selected movie and numeric fields", () => {
    expect(
      createMoviePayload(movieForm, {
        external_source: "tmdb",
        external_id: 329865,
      }),
    ).toMatchObject({
      external_source: "tmdb",
      external_id: 329865,
      title: "Arrival",
      original_title: "Arrival",
      poster_url: "https://example.com/poster.jpg",
      release_date: "2016-11-11",
      media_type: "movie",
      runtime_minutes: 116,
      status: "watched",
      rating: 9.5,
      review: "Thoughtful science fiction.",
    });
  });

  it("only creates viewing data for watched titles", () => {
    expect(createViewingPayload(movieForm)).toEqual({
      watched_at: "2026-08-12",
      watched_in_theater: true,
    });
    expect(createViewingPayload({ ...movieForm, status: "plan" })).toBeNull();
  });

  it("uses the first of the selected month as the batch fallback date", () => {
    const payload = createBatchPayload(
      {
        ...movieForm,
        external_source: "tmdb",
        external_id: 329865,
        watched_at: "",
      },
      "2026-08",
    );

    expect(payload.viewing.watched_at).toBe("2026-08-01");
    expect(payload.movie.status).toBe("watched");
  });
});

describe("add movie date and navigation helpers", () => {
  it("finds the last date of regular and leap-year months", () => {
    expect(getLastDateOfMonth("2026-04")).toBe("2026-04-30");
    expect(getLastDateOfMonth("2028-02")).toBe("2028-02-29");
    expect(getLastDateOfMonth("")).toBe("");
  });

  it("adds memory counts to the movie details path", () => {
    expect(
      createMovieDetailsPath("movie/id", {
        saved: [{ id: 1 }, { id: 2 }],
        failures: [new Error("upload failed")],
      }),
    ).toBe("/movies/movie%2Fid?memory_saved=2&memory_failed=1");
  });
});
