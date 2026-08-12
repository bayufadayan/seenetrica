import { describe, expect, it } from "vitest";
import {
  createMarvelReplacement,
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

  it("replaces only Marvel records and removes only Marvel outbox operations", () => {
    const replacement = createMarvelReplacement(
      {
        categories: [{ id: "CAT-MARVEL", slug: "marvel", name: "Marvel" }],
        titles: [{ id: "SERVER-MARVEL", categoryId: "CAT-MARVEL", identityKey: "movie:1" }],
      },
      [
        { id: "CAT-MARVEL", slug: "marvel", name: "Old Marvel" },
        { id: "CAT-NOIR", slug: "noir", name: "Noir" },
      ],
      [
        { id: "OLD-MARVEL", categoryId: "CAT-MARVEL", identityKey: "movie:2" },
        { id: "NOIR-TITLE", categoryId: "CAT-NOIR", identityKey: "movie:3" },
      ],
      [
        { id: "title:OLD-MARVEL", kind: "title", recordId: "OLD-MARVEL" },
        { id: "completion:OLD", kind: "completion", recordId: "OLD-MARVEL", categoryTitleId: "OLD-MARVEL" },
        { id: "completion:SERVER", kind: "completion", recordId: "SERVER-MARVEL", categoryTitleId: "SERVER-MARVEL" },
        { id: "title:NOIR-TITLE", kind: "title", recordId: "NOIR-TITLE" },
      ],
    );

    expect(replacement.categories.map((category) => category.id)).toEqual(["CAT-NOIR", "CAT-MARVEL"]);
    expect(replacement.titles.map((title) => title.id)).toEqual(["NOIR-TITLE", "SERVER-MARVEL"]);
    expect(replacement.outbox.map((operation) => operation.id)).toEqual(["title:NOIR-TITLE"]);
  });
});
