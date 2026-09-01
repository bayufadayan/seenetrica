import { describe, expect, it, vi } from "vitest";
import { archiveService } from "../../../services/archive.service";
import {
  buildCategoryIconPatch,
  centerSquareCrop,
  cleanupCategoryIcon,
  validateCategoryIcon,
} from "./category-icon.service";

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

  it("keeps icon fields empty when no icon is selected", () => {
    expect(
      buildCategoryIconPatch({
        existing: null,
        uploaded: null,
        removeIcon: false,
      }),
    ).toEqual({});
  });

  it("clears an existing icon and queues its uploaded asset for cleanup", () => {
    expect(
      buildCategoryIconPatch({
        existing: { iconPublicId: "seenetrica/categories/noir" },
        uploaded: null,
        removeIcon: true,
      }),
    ).toEqual({
      iconUrl: null,
      iconPublicId: null,
      cleanupIconPublicId: "seenetrica/categories/noir",
    });
  });

  it("replaces an existing icon and queues the previous asset for cleanup", () => {
    expect(
      buildCategoryIconPatch({
        existing: { iconPublicId: "old-icon" },
        uploaded: {
          iconUrl: "https://example.com/new.webp",
          iconPublicId: "new-icon",
        },
        removeIcon: false,
      }),
    ).toEqual({
      iconUrl: "https://example.com/new.webp",
      iconPublicId: "new-icon",
      cleanupIconPublicId: "old-icon",
    });
  });
});
