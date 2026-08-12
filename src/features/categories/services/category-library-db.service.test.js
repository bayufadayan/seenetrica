import { describe, expect, it } from "vitest";
import {
  createViewingEventId,
  mergeCategoryRecords,
  remapCategoryTitle,
} from "./category-library-db.service";

describe("category cache merging", () => {
  it("does not overwrite a pending local record during a background pull", () => {
    const server = [{ id: "title-1", categoryId: "cat", identityKey: "movie:1", isWatched: false }];
    const local = [{ id: "title-1", categoryId: "cat", identityKey: "movie:1", isWatched: true }];
    const merged = mergeCategoryRecords(server, local, new Set(["title-1"]), (record) => `${record.categoryId}:${record.identityKey}`);
    expect(merged).toEqual(local);
  });

  it("applies category/title ID maps to references and prerequisites", () => {
    const mapped = remapCategoryTitle(
      { id: "local-title", categoryId: "local-cat", prerequisiteIds: ["local-prerequisite"] },
      { "local-cat": "CAT-1" },
      { "local-title": "TITLE-1", "local-prerequisite": "TITLE-2" },
    );
    expect(mapped).toMatchObject({ id: "TITLE-1", categoryId: "CAT-1", prerequisiteIds: ["TITLE-2"] });
  });

  it("uses the same completion event after a retry", () => {
    expect(createViewingEventId("session")).toBe(createViewingEventId("session"));
  });
});
