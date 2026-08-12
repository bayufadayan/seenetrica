import { describe, expect, it } from "vitest";
import { buildRecommendationHistory, getEligibleTitles, pickUniqueRecommendation } from "./recommendation.util";

const titles = [
  { id: "watched", type: "movie", isWatched: true },
  { id: "movie", type: "movie", isWatched: false },
  { id: "blocked", type: "series", isWatched: false, prerequisiteIds: ["missing"] },
  { id: "ready", type: "series", isWatched: false, prerequisiteIds: ["watched"] },
  { id: "other", type: "movie", isWatched: false },
  { id: "fourth", type: "movie", isWatched: false },
  { id: "blocked-movie", type: "movie", isWatched: false, prerequisiteIds: ["missing"] },
];
describe("recommendations", () => {
  it("blocks series with unfinished prerequisites", () => expect(getEligibleTitles(titles).map((item) => item.id)).toEqual(["movie", "ready", "other", "fourth"]));
  it("does not repeat a seen recommendation", () => expect(pickUniqueRecommendation(titles, ["movie"], () => 0).id).not.toBe("movie"));
  it("returns at most three unique results", () => { const result = buildRecommendationHistory(titles, () => 0); expect(result).toHaveLength(3); expect(new Set(result.map((item) => item.id)).size).toBe(3); });
  it("applies prerequisites to movies too", () => expect(getEligibleTitles(titles).map((item) => item.id)).not.toContain("blocked-movie"));
});
