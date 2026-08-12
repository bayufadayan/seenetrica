import { archiveService } from "../../../services/archive.service";
import { playerDb } from "../../player/services/player-db.service";
import {
  categorySnapshotFromApi,
  categoryTitleToApi,
  categoryToApi,
} from "./category-mapper.service";
import { categoryLibraryDb } from "./category-library-db.service";

let pullInFlight = null;
let syncInFlight = null;

function requireCategorySnapshot(data) {
  if (!Array.isArray(data?.categories) || !Array.isArray(data?.category_titles)) {
    throw new Error("The server did not return the categorized library fields.");
  }
  return categorySnapshotFromApi(data);
}

function notify(name) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name));
}

async function migrateLegacyIfNeeded(snapshot, pin) {
  const legacyTitles = await playerDb.getLegacyTitles();
  if (snapshot.legacyMarvelMigrationCompletedAt) {
    await categoryLibraryDb.markLegacyBootstrapComplete();
    return { snapshot, migrationRequired: false };
  }
  if (!legacyTitles.length) return { snapshot, migrationRequired: false };

  await categoryLibraryDb.bootstrapLegacyMarvel(legacyTitles);
  if (!pin) return { snapshot, migrationRequired: true };

  const response = await archiveService.writeAction(
    "migrateLegacyMarvel",
    { titles: legacyTitles },
    pin,
  );
  const migrated = requireCategorySnapshot(response.snapshot || {});
  await categoryLibraryDb.markLegacyBootstrapComplete();
  await categoryLibraryDb.applyCanonicalSnapshot(migrated);
  notify("seenetrica:categories-changed");
  return { snapshot: migrated, migrationRequired: false, migrated: true };
}

async function runPull({ pin = null } = {}) {
  const data = await archiveService.fetchData();
  const snapshot = requireCategorySnapshot(data);
  const migration = await migrateLegacyIfNeeded(snapshot, pin);
  if (!migration.migrated) await categoryLibraryDb.mergeServerSnapshot(migration.snapshot);
  notify("seenetrica:categories-changed");
  return migration;
}

async function runSync(pin) {
  if (!pin) throw new Error("PIN is required to sync.");

  const pulled = await runPull({ pin });
  const state = await categoryLibraryDb.readAll();
  const libraryOperations = state.outbox.filter((operation) =>
    operation.kind === "category" || operation.kind === "title",
  );

  if (libraryOperations.length) {
    const categoryIds = new Set(
      libraryOperations.filter((operation) => operation.kind === "category").map((operation) => operation.recordId),
    );
    const titleIds = new Set(
      libraryOperations.filter((operation) => operation.kind === "title").map((operation) => operation.recordId),
    );
    const response = await archiveService.writeAction(
      "syncCategorizedLibrary",
      {
        categories: state.categories.filter((record) => categoryIds.has(record.id)).map(categoryToApi),
        category_titles: state.titles.filter((record) => titleIds.has(record.id)).map(categoryTitleToApi),
      },
      pin,
    );
    const canonical = requireCategorySnapshot(response.snapshot || {});
    await categoryLibraryDb.applyCanonicalSnapshot(
      canonical,
      response.id_map || {},
      libraryOperations.map((operation) => operation.id),
    );
  }

  const afterLibrary = await categoryLibraryDb.readAll();
  const iconCleanups = afterLibrary.outbox.filter((operation) => operation.kind === "iconCleanup");
  for (const operation of iconCleanups) {
    await archiveService.writeAction(
      "deleteCategoryIcon",
      { public_id: operation.publicId },
      pin,
    );
    await categoryLibraryDb.completeOutboxOperation(operation.id);
  }
  const completions = afterLibrary.outbox.filter((operation) => operation.kind === "completion");
  for (const operation of completions) {
    const response = await archiveService.writeAction(
      "recordCategorizedViewing",
      {
        event_id: operation.eventId,
        category_title_id: operation.categoryTitleId,
        watched_at: operation.watchedAt,
      },
      pin,
    );
    await categoryLibraryDb.completeOutboxOperation(operation.id);
    if (response.snapshot?.categories && response.snapshot?.category_titles) {
      await categoryLibraryDb.mergeServerSnapshot(categorySnapshotFromApi(response.snapshot));
    }
    notify("seenetrica:archive-refresh");
  }

  if (!pulled.migrationRequired) await runPull({ pin });
  notify("seenetrica:categories-changed");
  return categoryLibraryDb.hydrate();
}

export const categorySyncService = {
  pull(options = {}) {
    if (!pullInFlight) {
      pullInFlight = runPull(options).finally(() => { pullInFlight = null; });
    }
    return pullInFlight;
  },

  sync(pin) {
    if (!syncInFlight) {
      syncInFlight = runSync(pin).finally(() => { syncInFlight = null; });
    }
    return syncInFlight;
  },

  async syncInBackground() {
    const pin = archiveService.getSessionPin();
    if (!pin) return { skipped: true };
    return this.sync(pin);
  },
};
