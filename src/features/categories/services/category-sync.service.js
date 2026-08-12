import { archiveService } from "../../../services/archive.service";
import { playerDb } from "../../player/services/player-db.service";
import { normalizeLegacyTitle } from "../utils/title-draft.util";
import {
  categorySnapshotFromApi,
  categoryTitleToApi,
  categoryToApi,
} from "./category-mapper.service";
import { categoryLibraryDb } from "./category-library-db.service";

let pullInFlight = null;
let syncInFlight = null;
let migrationInFlight = null;

function syncError(code, stage, message, cause = null, summary = null) {
  const error = new Error(message);
  error.name = "CategorySyncError";
  error.code = code;
  error.stage = stage;
  if (cause) error.cause = cause;
  if (summary) error.summary = summary;
  return error;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function requireCategorySnapshot(data, {
  requireSyncMeta = false,
  source = "server",
  stage = "checking_server",
} = {}) {
  const syncMeta = data?.category_sync;
  if (
    !Array.isArray(data?.categories)
    || !Array.isArray(data?.category_titles)
    || (requireSyncMeta && (!syncMeta || typeof syncMeta !== "object" || Array.isArray(syncMeta)))
  ) {
    throw syncError(
      "invalid_snapshot",
      stage,
      `The ${source} snapshot is missing categories, category_titles, or category_sync.`,
    );
  }
  return categorySnapshotFromApi(data);
}

function notify(name) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name));
}

function developmentSummary(action, details) {
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    console.info(`[category-sync] ${action}`, details);
  }
}

async function readLegacyTitles() {
  try {
    const titles = await playerDb.getLegacyTitles();
    if (!Array.isArray(titles)) throw new Error("The titles store did not return an array.");
    return titles;
  } catch (error) {
    throw syncError(
      "legacy_storage_unavailable",
      "reading_legacy_storage",
      `The legacy Marvel IndexedDB could not be read: ${errorMessage(error)}`,
      error,
    );
  }
}

async function fetchServerSnapshot() {
  let data;
  try {
    data = await archiveService.fetchData();
  } catch (error) {
    throw syncError(
      "snapshot_request_failed",
      "checking_server",
      `Could not check the server migration status: ${errorMessage(error)}`,
      error,
    );
  }
  return requireCategorySnapshot(data, { requireSyncMeta: true, source: "server" });
}

async function storeSnapshot(snapshot, { canonical = false } = {}) {
  try {
    const state = canonical
      ? await categoryLibraryDb.applyCanonicalSnapshot(snapshot)
      : await categoryLibraryDb.mergeServerSnapshot(snapshot);
    return state || categoryLibraryDb.hydrate();
  } catch (error) {
    throw syncError(
      "cache_write_failed",
      "refreshing_cache",
      `The server responded, but the categorized cache could not be updated: ${errorMessage(error)}`,
      error,
    );
  }
}

async function markLegacyBootstrapComplete() {
  try {
    await categoryLibraryDb.markLegacyBootstrapComplete();
  } catch (error) {
    throw syncError(
      "cache_write_failed",
      "refreshing_cache",
      `The canonical snapshot was saved, but the local migration marker could not be updated: ${errorMessage(error)}`,
      error,
    );
  }
}

export function summarizeLegacyTitles(titles) {
  const normalized = (Array.isArray(titles) ? titles : []).map(normalizeLegacyTitle);
  const watched = normalized.filter((title) => title.isWatched).length;
  return {
    total: normalized.length,
    movies: normalized.filter((title) => title.type === "movie").length,
    series: normalized.filter((title) => title.type === "series").length,
    watched,
    unwatched: normalized.length - watched,
    prerequisites: normalized.reduce(
      (total, title) => total + (title.prerequisiteIds?.length || 0),
      0,
    ),
  };
}

function migrationPreview(titles) {
  return titles.map((title) => normalizeLegacyTitle(title));
}

export function verifyLegacyMigrationResponse(response, legacyTitles) {
  if (!["migrated", "already_completed"].includes(response?.status)) {
    throw syncError(
      "migration_response_invalid",
      "verifying_migration",
      "The migration endpoint returned an unsupported status.",
    );
  }

  const snapshot = requireCategorySnapshot(response.snapshot || {}, {
    source: "migration",
    stage: "verifying_migration",
  });
  if (!snapshot.legacyMarvelMigrationCompletedAt) {
    throw syncError(
      "migration_response_incomplete",
      "verifying_migration",
      "The server responded, but the migration completion marker is missing.",
    );
  }
  if (response.status === "already_completed") return snapshot;

  const marvel = snapshot.categories.find(
    (category) => !category.deletedAt && (category.id === "CAT-MARVEL" || category.slug === "marvel"),
  );
  if (!marvel) {
    throw syncError(
      "migration_response_incomplete",
      "verifying_migration",
      "The server migration snapshot does not contain the Marvel category.",
    );
  }

  const normalizedSource = legacyTitles.map(normalizeLegacyTitle);
  const uniqueSource = new Map(normalizedSource.map((title) => [title.identityKey, title]));
  const sourceById = new Map(normalizedSource.map((title) => [title.id, title]));
  const marvelTitles = snapshot.titles.filter(
    (title) => !title.deletedAt && title.categoryId === marvel.id,
  );
  const targetByIdentity = new Map(marvelTitles.map((title) => [title.identityKey, title]));
  const validTargetIds = new Set(snapshot.titles.filter((title) => !title.deletedAt).map((title) => title.id));

  for (const [identity, source] of uniqueSource) {
    const target = targetByIdentity.get(identity);
    if (!target) {
      throw syncError(
        "migration_response_incomplete",
        "verifying_migration",
        `The migrated server snapshot is missing ${source.title || identity}.`,
      );
    }
    for (const prerequisiteId of source.prerequisiteIds || []) {
      const sourcePrerequisite = sourceById.get(prerequisiteId);
      const targetPrerequisite = sourcePrerequisite
        ? targetByIdentity.get(sourcePrerequisite.identityKey)
        : null;
      if (
        !targetPrerequisite
        || !validTargetIds.has(targetPrerequisite.id)
        || !target.prerequisiteIds.includes(targetPrerequisite.id)
      ) {
        throw syncError(
          "migration_response_incomplete",
          "verifying_migration",
          `The prerequisite relationships for ${source.title || identity} were not preserved.`,
        );
      }
    }
  }

  if (
    response.migrated_count !== undefined
    && Number(response.migrated_count) !== legacyTitles.length
  ) {
    throw syncError(
      "migration_response_incomplete",
      "verifying_migration",
      `The server reported ${response.migrated_count} migrated titles after receiving ${legacyTitles.length}.`,
    );
  }
  return snapshot;
}

async function runInspection() {
  const legacyTitles = await readLegacyTitles();
  const snapshot = await fetchServerSnapshot();
  const marker = snapshot.legacyMarvelMigrationCompletedAt;
  let state;

  if (marker) {
    state = await storeSnapshot(snapshot, { canonical: true });
    await markLegacyBootstrapComplete();
  } else {
    state = await storeSnapshot(snapshot);
  }
  notify("seenetrica:categories-changed");

  const migrationRequired = !marker && legacyTitles.length > 0;
  developmentSummary("inspect", {
    legacyCount: legacyTitles.length,
    markerPresent: Boolean(marker),
    migrationRequired,
  });
  return {
    status: marker ? "completed" : migrationRequired ? "confirmation_required" : "not_required",
    marker,
    migrationRequired,
    verified: !migrationRequired,
    legacyTitles: migrationPreview(legacyTitles),
    summary: summarizeLegacyTitles(legacyTitles),
    snapshot,
    state,
  };
}

function migrationPostError(error) {
  if (/invalid write action|unknown action|not allowed/i.test(errorMessage(error))) {
    return syncError(
      "proxy_action_rejected",
      "uploading_migration",
      "The /api/data proxy rejected the migrateLegacyMarvel action. Deploy the updated proxy before retrying.",
      error,
    );
  }
  if (/pin|unauthori[sz]ed|forbidden|authentication/i.test(errorMessage(error))) {
    return syncError(
      "unauthorized",
      "uploading_migration",
      "The migration was not authorized. Check the Seenetrica PIN and retry.",
      error,
    );
  }
  return syncError(
    "migration_post_failed",
    "uploading_migration",
    `The Marvel migration upload failed: ${errorMessage(error)}`,
    error,
  );
}

async function runConfirmedMigration(pin, onStage = () => {}) {
  if (!pin) {
    throw syncError("pin_required", "requesting_pin", "A Seenetrica PIN is required to migrate.");
  }

  onStage("checking_server");
  const latestSnapshot = await fetchServerSnapshot();
  if (latestSnapshot.legacyMarvelMigrationCompletedAt) {
    onStage("refreshing_cache");
    const state = await storeSnapshot(latestSnapshot, { canonical: true });
    await markLegacyBootstrapComplete();
    notify("seenetrica:categories-changed");
    return {
      status: "already_completed",
      marker: latestSnapshot.legacyMarvelMigrationCompletedAt,
      migratedCount: 0,
      snapshot: latestSnapshot,
      state,
    };
  }

  const legacyTitles = await readLegacyTitles();
  if (!legacyTitles.length) {
    const state = await storeSnapshot(latestSnapshot);
    notify("seenetrica:categories-changed");
    return {
      status: "not_required",
      marker: null,
      migratedCount: 0,
      snapshot: latestSnapshot,
      state,
    };
  }

  onStage("uploading_migration");
  let response;
  try {
    response = await archiveService.writeAction(
      "migrateLegacyMarvel",
      { titles: legacyTitles },
      pin,
    );
  } catch (error) {
    throw migrationPostError(error);
  }

  onStage("verifying_migration");
  const canonical = verifyLegacyMigrationResponse(response, legacyTitles);
  onStage("refreshing_cache");
  const state = await storeSnapshot(canonical, { canonical: true });
  await markLegacyBootstrapComplete();
  notify("seenetrica:categories-changed");
  developmentSummary("migrateLegacyMarvel", {
    status: response.status,
    sentCount: legacyTitles.length,
    serverTime: canonical.serverTime,
  });
  return {
    status: response.status,
    marker: canonical.legacyMarvelMigrationCompletedAt,
    migratedCount: response.status === "migrated" ? legacyTitles.length : 0,
    snapshot: canonical,
    state,
  };
}

function wrapLibrarySyncError(error, pushed) {
  if (error?.name === "CategorySyncError") {
    if (pushed > 0 && !error.summary) {
      error.summary = { pushed };
      error.partial = true;
      error.message = `${error.message} ${pushed} outbox operation${pushed === 1 ? " was" : "s were"} already accepted by the server.`;
    }
    return error;
  }
  if (/invalid write action|unknown action|not allowed/i.test(errorMessage(error))) {
    return syncError(
      "proxy_action_rejected",
      "syncing_library",
      `The /api/data proxy rejected a categorized sync action after ${pushed} successful operations.`,
      error,
      { pushed },
    );
  }
  if (/pin|unauthori[sz]ed|forbidden|authentication/i.test(errorMessage(error))) {
    return syncError(
      "unauthorized",
      "syncing_library",
      "Categorized library sync was not authorized. Check the Seenetrica PIN and retry.",
      error,
      { pushed },
    );
  }
  return syncError(
    "library_sync_failed",
    "syncing_library",
    `Categorized library sync failed after ${pushed} successful operation${pushed === 1 ? "" : "s"}: ${errorMessage(error)}`,
    error,
    { pushed },
  );
}

async function runSync(pin) {
  if (!pin) throw syncError("pin_required", "requesting_pin", "PIN is required to sync.");

  let pushed = 0;
  try {
    const state = await categoryLibraryDb.readAll();
    const libraryOperations = state.outbox.filter((operation) =>
      operation.kind === "category" || operation.kind === "title",
    );

    if (libraryOperations.length) {
      const categoryIds = new Set(
        libraryOperations
          .filter((operation) => operation.kind === "category")
          .map((operation) => operation.recordId),
      );
      const titleIds = new Set(
        libraryOperations
          .filter((operation) => operation.kind === "title")
          .map((operation) => operation.recordId),
      );
      const response = await archiveService.writeAction(
        "syncCategorizedLibrary",
        {
          categories: state.categories
            .filter((record) => categoryIds.has(record.id))
            .map(categoryToApi),
          category_titles: state.titles
            .filter((record) => titleIds.has(record.id))
            .map(categoryTitleToApi),
        },
        pin,
      );
      const canonical = requireCategorySnapshot(response?.snapshot || {}, {
        source: "categorized library sync",
        stage: "syncing_library",
      });
      await categoryLibraryDb.applyCanonicalSnapshot(
        canonical,
        response.id_map || {},
        libraryOperations.map((operation) => operation.id),
      );
      pushed += libraryOperations.length;
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
      pushed += 1;
    }

    const afterIcons = await categoryLibraryDb.readAll();
    const completions = afterIcons.outbox.filter((operation) => operation.kind === "completion");
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
      pushed += 1;
      if (response.snapshot?.categories && response.snapshot?.category_titles) {
        await categoryLibraryDb.mergeServerSnapshot(
          requireCategorySnapshot(response.snapshot, {
            source: "viewing completion",
            stage: "syncing_completion",
          }),
        );
      }
      notify("seenetrica:archive-refresh");
    }

    // A real no-store pull is always performed, even when there was nothing to push.
    const pullResult = await runInspection();
    const finalState = pullResult.state || await categoryLibraryDb.hydrate();
    const summary = {
      pushed,
      pulled: pullResult.snapshot.categories.length + pullResult.snapshot.titles.length,
      remaining: finalState.outbox.length,
      serverTime: pullResult.snapshot.serverTime,
      migrationRequired: pullResult.migrationRequired,
      state: finalState,
      pullResult,
    };
    developmentSummary("syncCategorizedLibrary", {
      pushed: summary.pushed,
      pulled: summary.pulled,
      remaining: summary.remaining,
      serverTime: summary.serverTime,
    });
    notify("seenetrica:categories-changed");
    return summary;
  } catch (error) {
    throw wrapLibrarySyncError(error, pushed);
  }
}

export const categorySyncService = {
  inspectLegacyMarvelMigration() {
    if (syncInFlight) return syncInFlight.then((result) => result.pullResult);
    if (migrationInFlight) {
      return migrationInFlight.then(() => this.inspectLegacyMarvelMigration());
    }
    if (!pullInFlight) {
      pullInFlight = runInspection().finally(() => { pullInFlight = null; });
    }
    return pullInFlight;
  },

  pull() {
    return this.inspectLegacyMarvelMigration();
  },

  confirmLegacyMarvelMigration(pin, { onStage } = {}) {
    if (!migrationInFlight) {
      migrationInFlight = (async () => {
        if (syncInFlight) await syncInFlight;
        if (pullInFlight) await pullInFlight;
        return runConfirmedMigration(pin, onStage);
      })().finally(() => { migrationInFlight = null; });
    }
    return migrationInFlight;
  },

  sync(pin) {
    if (!syncInFlight) {
      syncInFlight = (async () => {
        if (migrationInFlight) await migrationInFlight;
        if (pullInFlight) await pullInFlight;
        return runSync(pin);
      })().finally(() => { syncInFlight = null; });
    }
    return syncInFlight;
  },

  async syncInBackground() {
    const pin = archiveService.getSessionPin();
    if (!pin) return { skipped: true };
    return this.sync(pin);
  },
};
