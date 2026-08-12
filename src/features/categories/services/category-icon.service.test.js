import { describe, expect, it, vi } from "vitest";
import { archiveService } from "../../../services/archive.service";
import { centerSquareCrop, cleanupCategoryIcon, validateCategoryIcon } from "./category-icon.service";

describe("category icons", () => {
  it("validates supported formats", () => {
    expect(validateCategoryIcon({ type: "image/png" })).toEqual({ type: "image/png" });
    expect(() => validateCategoryIcon({ type: "image/gif" })).toThrow("JPG, PNG, or WebP");
  });

  it("calculates a centered square crop before 96px compression", () => {
    expect(centerSquareCrop(300, 200)).toEqual({ x: 50, y: 0, size: 200 });
    expect(centerSquareCrop(100, 240)).toEqual({ x: 0, y: 70, size: 100 });
  });

  it("uses the backend cleanup action and exposes cleanup failures", async () => {
    const write = vi.spyOn(archiveService, "writeAction").mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(cleanupCategoryIcon("orphan-id", "1234")).rejects.toThrow("cleanup failed");
    expect(write).toHaveBeenCalledWith("deleteCategoryIcon", { public_id: "orphan-id" }, "1234");
    write.mockRestore();
  });
});
