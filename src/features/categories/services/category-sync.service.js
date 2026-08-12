import { archiveService } from "../../../services/archive.service";
import {
  categorySnapshotFromApi,
  categoryTitleToApi,
  categoryToApi,
} from "./category-mapper.service";
import { categoryLibraryDb } from "./category-library-db.service";

let pullInFlight = null;
let syncInFlight = null;

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

export function requireCategorySnapshot(data, { source = "server", stage = "pulling" } = {}) {
  if (
    !Array.isArray(data?.categories)
    || !Array.isArray(data?.category_titles)
    || !data?.category_sync
    || typeof data.category_sync !== "object"
    || Array.isArray(data.category_sync)
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

async function fetchServerSnapshot() {
  try {
    return requireCategorySnapshot(await archiveService.fetchCategorizedData());
  } catch (error) {
    if (error?.name === "CategorySyncError") throw error;
    throw syncError(
      "snapshot_request_failed",
      "pulling",
      `Could not fetch categorized data: ${errorMessage(error)}`,
      error,
    );
  }
}

async function runPull() {
  const snapshot = await fetchServerSnapshot();
  let state;
  try {
    state = await categoryLibraryDb.mergeServerSnapshot(snapshot);
  } catch (error) {
    throw syncError(
      "cache_write_failed",
      "updating_cache",
      `The categorized snapshot could not be written to the local cache: ${errorMessage(error)}`,
      error,
    );
  }
  notify("seenetrica:categories-changed");
  return { snapshot, state, verified: true };
}

function wrapLibrarySyncError(error, pushed) {
  if (error?.name === "CategorySyncError") {
    if (pushed > 0 && !error.summary) {
      error.summary = { pushed };
      error.partial = true;
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

    const pullResult = await runPull();
    const finalState = pullResult.state || await categoryLibraryDb.hydrate();
    const summary = {
      pushed,
      pulled: pullResult.snapshot.categories.length + pullResult.snapshot.titles.length,
      remaining: finalState.outbox.length,
      serverTime: pullResult.snapshot.serverTime,
      state: finalState,
      pullResult,
    };
    notify("seenetrica:categories-changed");
    return summary;
  } catch (error) {
    throw wrapLibrarySyncError(error, pushed);
  }
}

export const categorySyncService = {
  pull() {
    if (!pullInFlight) {
      pullInFlight = runPull().finally(() => { pullInFlight = null; });
    }
    return pullInFlight;
  },

  sync(pin) {
    if (!syncInFlight) {
      syncInFlight = (async () => {
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
