import { describe, expect, it } from "vitest";
import { buildCommercialPlan } from "./commercial-plan.util";

const media = [{ id: "a", durationSeconds: 30 }, { id: "b", durationSeconds: 25 }, { id: "c", durationSeconds: 20 }];
describe("buildCommercialPlan", () => {
  it("does not repeat media already used in a session", () => { const plan = buildCommercialPlan({ media, targetDurationSeconds: 50, usedIds: ["a"], random: () => 0 }); expect(plan.items.some((item) => item.id === "a")).toBe(false); expect(new Set(plan.items.filter((item) => !item.id.startsWith("countdown")).map((item) => item.id)).size).toBe(plan.items.filter((item) => !item.id.startsWith("countdown")).length); });
  it("uses countdown fallback when media is empty", () => { const plan = buildCommercialPlan({ media: [], targetDurationSeconds: 45 }); expect(plan.items).toEqual([{ id: "countdown-0", kind: "countdown", durationSeconds: 45 }]); });
});
