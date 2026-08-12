import { describe, expect, it } from "vitest";
import { categorySnapshotFromApi, categoryTitleToApi } from "./category-mapper.service";

describe("category API mapper", () => {
  it("keeps snake_case at the service boundary", () => {
    const snapshot = categorySnapshotFromApi({
      categories: [{ id: "CAT", name: "Marvel", slug: "marvel", icon_url: "icon", sort_order: 1 }],
      category_titles: [{ id: "TITLE", category_id: "CAT", tmdb_id: 42, title: "Film", media_type: "movie", identity_key: "movie:42", prerequisite_ids: [] }],
      category_sync: { legacy_marvel_migration_completed_at: "2026-01-01", server_time: "now" },
    });
    expect(snapshot.categories[0].iconUrl).toBe("icon");
    expect(snapshot.titles[0].categoryId).toBe("CAT");
    expect(categoryTitleToApi(snapshot.titles[0])).toMatchObject({ category_id: "CAT", tmdb_id: 42, media_type: "movie" });
  });
});
