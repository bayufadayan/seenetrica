import { describe, expect, it } from "vitest";
import { buildCommercialBreakpoints } from "./breakpoint.util";

const settings = { midRoll: { enabled: true, intervalMinMinutes: 24, intervalMaxMinutes: 30, durationMinMinutes: 3, durationMaxMinutes: 5, firstBreakAfterMinutes: 20, noBreakLastMinutes: 15 } };
describe("buildCommercialBreakpoints", () => {
  it("keeps stable breaks inside the safe movie window", () => { const first = buildCommercialBreakpoints({ movieDurationSeconds: 3 * 60 * 60, settings, seed: "session-a" }); const second = buildCommercialBreakpoints({ movieDurationSeconds: 3 * 60 * 60, settings, seed: "session-a" }); expect(first).toEqual(second); expect(first.length).toBeGreaterThan(0); for (const point of first) { expect(point.atMovieSecond).toBeGreaterThanOrEqual(20 * 60); expect(point.atMovieSecond).toBeLessThan(3 * 60 * 60 - 15 * 60); expect(point.atMovieSecond).toBeLessThan(3 * 60 * 60); } });
  it("returns no breaks when disabled", () => expect(buildCommercialBreakpoints({ movieDurationSeconds: 5000, settings: { midRoll: { ...settings.midRoll, enabled: false } }, seed: "x" })).toEqual([]));
});
