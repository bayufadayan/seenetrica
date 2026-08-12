import { describe, expect, it } from "vitest";
import { createViewingEventId } from "../../categories/services/category-library-db.service";
import { shouldRecordCategorizedViewing } from "./useBroadcastSession";

describe("player completion routing", () => {
  it("creates one stable event ID for every retry", () => {
    expect(createViewingEventId("session-1")).toBe("category-viewing:session-1");
    expect(createViewingEventId("session-1")).toBe(createViewingEventId("session-1"));
  });

  it("records only completed category watch sessions", () => {
    expect(shouldRecordCategorizedViewing({ mode: "watch", sourceKind: "category", categoryTitleId: "title" })).toBe(true);
    expect(shouldRecordCategorizedViewing({ mode: "test", sourceKind: "category", categoryTitleId: "title" })).toBe(false);
    expect(shouldRecordCategorizedViewing({ mode: "watch", sourceKind: "anything" })).toBe(false);
  });
});
