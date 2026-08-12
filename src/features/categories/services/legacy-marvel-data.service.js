import { archiveService } from "../../../services/archive.service";
import { playerDb } from "../../player/services/player-db.service";
import {
  chunkLegacyMarvelTitles,
  prepareLegacyMarvelDataset,
} from "../utils/legacy-marvel-migration.util";
import { categoryTitleToApi } from "./category-mapper.service";
import { categoryLibraryDb } from "./category-library-db.service";
import { requireCategorySnapshot } from "./category-sync.service";

let operationInFlight = null;

function findMarvel(snapshot) {
  const marvel = snapshot.categories.find(
    (category) => !category.deletedAt && (category.id === "CAT-MARVEL" || category.slug === "marvel"),
  );
  if (!marvel) throw new Error("The Spreadsheet snapshot does not contain the Marvel category.");
  return {
    marvel,
    titles: snapshot.titles.filter(
      (title) => !title.deletedAt && title.categoryId === marvel.id,
    ),
  };
}

async function fetchMarvelSnapshot(stage) {
  let data;
  try {
    data = await archiveService.fetchCategorizedData();
  } catch (error) {
    throw new Error(`Could not fetch Marvel data from the Spreadsheet: ${error.message}`);
  }
  const snapshot = requireCategorySnapshot(data, { source: "categorized", stage });
  return { snapshot, ...findMarvel(snapshot) };
}

function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seenetrica:categories-changed"));
  }
}

function addServerMappings(dataset, serverTitles, serverIdByLegacyId) {
  const serverByIdentity = new Map(serverTitles.map((title) => [title.identityKey, title]));
  for (const source of dataset) {
    const target = serverByIdentity.get(source.identityKey);
    if (target) serverIdByLegacyId.set(source.id, target.id);
  }
  return serverByIdentity;
}

function createBatchPayload(batch, marvelId, serverIdByLegacyId) {
  return batch.map((title) => categoryTitleToApi({
    ...title,
    categoryId: marvelId,
    prerequisiteIds: title.prerequisiteIds.map(
      (id) => serverIdByLegacyId.get(id) || id,
    ),
    deletedAt: null,
  }));
}

export function verifyLegacyMarvelMerge(dataset, migratedIdentities, snapshot) {
  const { titles: serverTitles } = findMarvel(snapshot);
  const serverByIdentity = new Map(serverTitles.map((title) => [title.identityKey, title]));
  const sourceById = new Map(dataset.map((title) => [title.id, title]));

  for (const source of dataset) {
    const target = serverByIdentity.get(source.identityKey);
    if (!target) throw new Error(`The refreshed Spreadsheet is missing ${source.title}.`);
    if (!migratedIdentities.has(source.identityKey)) continue;

    for (const prerequisiteId of source.prerequisiteIds) {
      const sourcePrerequisite = sourceById.get(prerequisiteId);
      const targetPrerequisite = sourcePrerequisite
        ? serverByIdentity.get(sourcePrerequisite.identityKey)
        : null;
      if (!targetPrerequisite || !target.prerequisiteIds.includes(targetPrerequisite.id)) {
        throw new Error(`The prerequisite relationships for ${source.title} were not preserved.`);
      }
    }
  }
}

async function runMigration(pin, onProgress = () => {}) {
  if (!pin) throw new Error("A Seenetrica PIN is required to migrate.");

  onProgress({ stage: "reading", completed: 0, total: 0 });
  const legacy = await playerDb.getLegacyTitles();
  if (!legacy.length) return { migrated: 0, skipped: 0, total: 0, state: null };
  const dataset = prepareLegacyMarvelDataset(legacy);

  onProgress({ stage: "checking", completed: 0, total: dataset.length });
  const initial = await fetchMarvelSnapshot("checking_legacy");
  const serverIdByLegacyId = new Map();
  const initialByIdentity = addServerMappings(dataset, initial.titles, serverIdByLegacyId);
  const missing = dataset.filter((title) => !initialByIdentity.has(title.identityKey));
  const migratedIdentities = new Set(missing.map((title) => title.identityKey));
  const batches = chunkLegacyMarvelTitles(missing);
  let completed = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    onProgress({
      stage: "migrating",
      completed,
      total: missing.length,
      batch: index + 1,
      totalBatches: batches.length,
    });
    const response = await archiveService.writeAction(
      "syncCategorizedLibrary",
      {
        categories: [],
        category_titles: createBatchPayload(batch, initial.marvel.id, serverIdByLegacyId),
      },
      pin,
    );
    const responseSnapshot = requireCategorySnapshot(response?.snapshot || {}, {
      source: "categorized library sync",
      stage: "migrating_legacy",
    });
    const idMap = response.id_map?.category_titles || {};
    for (const title of batch) {
      if (idMap[title.id]) serverIdByLegacyId.set(title.id, idMap[title.id]);
    }
    addServerMappings(dataset, findMarvel(responseSnapshot).titles, serverIdByLegacyId);
    completed += batch.length;
    onProgress({
      stage: "migrating",
      completed,
      total: missing.length,
      batch: index + 1,
      totalBatches: batches.length,
    });
  }

  onProgress({ stage: "verifying", completed, total: missing.length });
  const final = await fetchMarvelSnapshot("verifying_legacy");
  onProgress({ stage: "updating_cache", completed, total: missing.length });
  const state = await categoryLibraryDb.mergeServerSnapshot(final.snapshot);
  verifyLegacyMarvelMerge(dataset, migratedIdentities, final.snapshot);

  onProgress({ stage: "clearing_legacy", completed, total: missing.length });
  await playerDb.clearLegacyTitles();
  notifyChanged();
  return {
    migrated: missing.length,
    skipped: dataset.length - missing.length,
    total: dataset.length,
    state,
  };
}

async function runSynchronize(onProgress = () => {}) {
  onProgress({ stage: "checking", completed: 0, total: 0 });
  const latest = await fetchMarvelSnapshot("synchronizing_legacy");
  onProgress({ stage: "updating_cache", completed: 0, total: latest.titles.length });
  const state = await categoryLibraryDb.replaceMarvelFromServer(latest.snapshot);
  onProgress({ stage: "clearing_legacy", completed: latest.titles.length, total: latest.titles.length });
  await playerDb.clearLegacyTitles();
  notifyChanged();
  return { replaced: latest.titles.length, state };
}

function singleFlight(operation) {
  if (!operationInFlight) {
    operationInFlight = operation().finally(() => { operationInFlight = null; });
  }
  return operationInFlight;
}

export const legacyMarvelDataService = {
  async inspect() {
    const available = await playerDb.hasLegacyTitles();
    if (!available) return { available: false, count: 0 };
    const titles = await playerDb.getLegacyTitles();
    return { available: titles.length > 0, count: titles.length };
  },

  migrate(pin, options = {}) {
    return singleFlight(() => runMigration(pin, options.onProgress));
  },

  synchronize(options = {}) {
    return singleFlight(() => runSynchronize(options.onProgress));
  },
};
