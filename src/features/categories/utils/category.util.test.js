import { describe, expect, it } from "vitest";
import { categoryDisplayName, createCategorySlug, normalizeCategoryName } from "./category.util";

describe("category names", () => {
  it("adds the Films suffix exactly once", () => {
    expect(categoryDisplayName("Marvel")).toBe("Marvel Films");
    expect(categoryDisplayName("Marvel Film")).toBe("Marvel Films");
    expect(categoryDisplayName("Marvel Films")).toBe("Marvel Films");
    expect(categoryDisplayName("Marvel Films Films")).toBe("Marvel Films");
    expect(categoryDisplayName("Films")).toBe("Films");
    expect(normalizeCategoryName("  DC Films  ")).toBe("DC");
  });

  it("creates a stable normalized slug", () => {
    expect(createCategorySlug("Bottle Films")).toBe("bottle");
    expect(createCategorySlug("Café Noir Film")).toBe("cafe-noir");
  });
});
