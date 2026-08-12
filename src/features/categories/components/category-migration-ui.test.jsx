import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CategorySyncStatusView } from "./CategorySyncStatus";
import {
  LegacyMarvelMigrationDialog,
  LegacyMarvelMigrationReminder,
} from "./LegacyMarvelMigrationModal";

describe("legacy migration UI", () => {
  it("shows the complete summary and lightweight title preview", () => {
    const html = renderToStaticMarkup(
      <LegacyMarvelMigrationDialog
        migration={{
          status: "confirmation_required",
          stage: null,
          error: null,
          summary: { total: 2, movies: 1, series: 1, watched: 1, unwatched: 1, prerequisites: 1 },
          titles: [
            { id: "one", title: "Iron Man", type: "movie", releaseDate: "2008-05-02", isWatched: true },
            { id: "two", title: "Loki S1", type: "series", seasonNumber: 1, releaseDate: "2021-06-09", isWatched: false },
          ],
        }}
        onMigrate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(html).toContain("Migrate Marvel Films?");
    expect(html).toContain("Migrate 2 Titles");
    expect(html).toContain("Iron Man");
    expect(html).toContain("Movie · 2008");
    expect(html).toContain("Watched");
    expect(html).toContain("Loki S1");
    expect(html).toContain("Season 1 · 2021");
    expect(html).toContain("Unwatched");
    expect(html).toContain("Prerequisites");
    expect(html).toContain(">1</dd>");
  });

  it("keeps a manual Sync button visible in the synced state", () => {
    const html = renderToStaticMarkup(
      <CategorySyncStatusView
        syncStatus="synced"
        syncMeta={{ lastPulledAt: "2026-08-12T12:00:00.000Z" }}
        busy={false}
        migrationPending={false}
        onReviewMigration={vi.fn()}
        onSync={vi.fn()}
      />,
    );
    expect(html).toContain("Synced");
    expect(html).toContain("Sync</button>");
  });

  it("shows Migration pending and Review Migration after dismissal", () => {
    const statusHtml = renderToStaticMarkup(
      <CategorySyncStatusView
        syncStatus="migration-pending"
        syncMeta={null}
        busy={false}
        migrationPending
        onReviewMigration={vi.fn()}
        onSync={vi.fn()}
      />,
    );
    const reminderHtml = renderToStaticMarkup(
      <LegacyMarvelMigrationReminder
        migration={{ status: "dismissed" }}
        onReview={vi.fn()}
      />,
    );
    expect(statusHtml).toContain("Migration pending");
    expect(statusHtml).toContain("Review Migration");
    expect(statusHtml).toContain("Sync</button>");
    expect(reminderHtml).toContain("Migration pending");
    expect(reminderHtml).toContain("Review Migration");
  });
});
