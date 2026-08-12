import { describe, expect, it, vi } from "vitest";
import { categoryMenuItems, closeCategoryMenuWithEscape, shouldCloseCategoryMenu } from "./category-menu.util";

describe("category menu", () => {
  const categories = [
    { id: "1", name: "Marvel", slug: "marvel" },
    { id: "2", name: "DC", slug: "dc" },
    { id: "3", name: "Bottle", slug: "bottle" },
  ];

  it("shows the three initial server categories", () => {
    expect(categoryMenuItems(categories).map((item) => item.label)).toEqual([
      "Marvel Films",
      "DC Films",
      "Bottle Films",
    ]);
  });

  it("closes for an outside target", () => {
    const inside = {};
    const root = { contains: (target) => target === inside };
    expect(shouldCloseCategoryMenu(root, inside)).toBe(false);
    expect(shouldCloseCategoryMenu(root, {})).toBe(true);
  });

  it("closes on Escape and restores trigger focus", () => {
    const close = vi.fn();
    const focus = vi.fn();
    expect(closeCategoryMenuWithEscape({ key: "Escape" }, close, { focus })).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
});
