import { describe, expect, it } from "vitest";
import { countMoviesByTitle, normalizeMovieTitle } from "./movie-duplicates.util";

describe("movie duplicate titles", () => {
  it("normalizes case, repeated whitespace, and Unicode width", () => {
    expect(normalizeMovieTitle("  THE   BATMAN  ")).toBe("the batman");
    expect(normalizeMovieTitle("Ａｒｃａｎｅ")).toBe("arcane");
  });

  it("counts titles only, even when years and media types differ", () => {
    const movies = [
      { title: "Dune", release_date: "1984-01-01", media_type: "movie" },
      { title: " dune ", release_date: "2021-01-01", media_type: "movie" },
      { title: "Dark", media_type: "series" },
      { title: "DARK", media_type: "movie" },
      { title: "    " },
    ];
    const counts = countMoviesByTitle(movies);

    expect(counts.get("dune")).toBe(2);
    expect(counts.get("dark")).toBe(2);
    expect(counts.has("")).toBe(false);
  });

  it("does not modify the input records", () => {
    const movies = [{ title: "Parasite" }];
    countMoviesByTitle(movies);
    expect(movies).toEqual([{ title: "Parasite" }]);
  });
});
