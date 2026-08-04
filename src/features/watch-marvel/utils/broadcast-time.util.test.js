import { describe, expect, it } from "vitest";
import { calculateScheduledStart } from "./broadcast-time.util";

describe("calculateScheduledStart", () => {
  it.each([
    ["2026-08-04T17:45:00", "2026-08-04T17:55:00"],
    ["2026-08-04T17:53:00", "2026-08-04T18:00:00"],
    ["2026-08-04T23:53:00", "2026-08-05T00:00:00"],
    ["2026-08-04T17:49:58", "2026-08-04T18:00:00"],
  ])("schedules %s at %s", (now, expected) => {
    const result = calculateScheduledStart(new Date(now), 6, 10);
    expect(result.getTime()).toBe(new Date(expected).getTime());
    expect(result.getMinutes() % 5).toBe(0);
    const seconds = (result - new Date(now)) / 1000;
    expect(seconds).toBeGreaterThanOrEqual(360);
    expect(seconds).toBeLessThanOrEqual(659);
  });
  it.each([[0, 10], [10, 6], [Number.NaN, 10]])("rejects invalid range %s-%s", (min, max) => expect(() => calculateScheduledStart(new Date(), min, max)).toThrow());
});
