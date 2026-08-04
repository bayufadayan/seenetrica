import { describe, expect, it } from "vitest";
import { isEligibleYouTubeTrailer, isLikelyYouTubeShort } from "./youtube-video.util";

describe("isLikelyYouTubeShort", () => {
  it("filters very short vertical-style uploads", () => {
    expect(isLikelyYouTubeShort({ title: "Quick cinema update", durationSeconds: 45 })).toBe(true);
  });

  it("filters videos explicitly marked as Shorts", () => {
    expect(isLikelyYouTubeShort({ title: "Behind the scenes #Shorts", durationSeconds: 150 })).toBe(true);
  });

  it("keeps ordinary trailers longer than one minute", () => {
    expect(isLikelyYouTubeShort({ title: "Official Teaser Trailer", durationSeconds: 92 })).toBe(false);
  });

  it("accepts trailers up to four minutes", () => {
    expect(isEligibleYouTubeTrailer({ title: "Official Trailer", durationSeconds: 240 })).toBe(true);
  });

  it("rejects videos longer than four minutes", () => {
    expect(isEligibleYouTubeTrailer({ title: "Full interview", durationSeconds: 241 })).toBe(false);
  });
});
