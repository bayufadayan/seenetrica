import { normalizeLegacyTitle } from "./title-draft.util";

export const LEGACY_MARVEL_BATCH_SIZE = 10;

function compareRecords(left, right) {
  return String(left.identityKey).localeCompare(String(right.identityKey))
    || String(left.id).localeCompare(String(right.id));
}

function unique(values) {
  return [...new Set(values)];
}

function describeTitles(records) {
  return records
    .slice(0, 3)
    .map((record) => record.title || record.baseTitle || record.identityKey || record.id)
    .join(", ");
}

export function prepareLegacyMarvelDataset(records) {
  if (!Array.isArray(records)) throw new Error("Legacy Marvel titles must be an array.");

  const normalized = records.map(normalizeLegacyTitle).sort(compareRecords);
  const selectedByIdentity = new Map();
  const aliasToSelectedId = new Map();

  for (const record of normalized) {
    const selected = selectedByIdentity.get(record.identityKey) || record;
    selectedByIdentity.set(record.identityKey, selected);
    if (record.id) aliasToSelectedId.set(record.id, selected.id);
  }

  const deduplicated = [...selectedByIdentity.values()]
    .map((record) => ({
      ...record,
      prerequisiteIds: unique(
        (record.prerequisiteIds || []).map((id) => aliasToSelectedId.get(id) || id),
      ),
    }))
    .sort(compareRecords);
  const byId = new Map(deduplicated.map((record) => [record.id, record]));

  for (const record of deduplicated) {
    const missing = record.prerequisiteIds.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new Error(
        `${record.title || record.identityKey} references a missing prerequisite (${missing.join(", ")}).`,
      );
    }
  }

  const dependents = new Map(deduplicated.map((record) => [record.id, []]));
  const indegree = new Map(
    deduplicated.map((record) => [record.id, record.prerequisiteIds.length]),
  );
  for (const record of deduplicated) {
    for (const prerequisiteId of record.prerequisiteIds) {
      dependents.get(prerequisiteId).push(record);
    }
  }
  for (const recordsForPrerequisite of dependents.values()) {
    recordsForPrerequisite.sort(compareRecords);
  }

  const ready = deduplicated.filter((record) => indegree.get(record.id) === 0).sort(compareRecords);
  const sorted = [];
  while (ready.length) {
    const next = ready.shift();
    sorted.push(next);
    for (const dependent of dependents.get(next.id)) {
      const remaining = indegree.get(dependent.id) - 1;
      indegree.set(dependent.id, remaining);
      if (remaining === 0) {
        ready.push(dependent);
        ready.sort(compareRecords);
      }
    }
  }

  if (sorted.length !== deduplicated.length) {
    const cycle = deduplicated.filter((record) => indegree.get(record.id) > 0);
    throw new Error(`Circular prerequisites found for: ${describeTitles(cycle)}.`);
  }
  return sorted;
}

export function chunkLegacyMarvelTitles(records, batchSize = LEGACY_MARVEL_BATCH_SIZE) {
  if (batchSize !== LEGACY_MARVEL_BATCH_SIZE) {
    throw new Error(`Legacy Marvel batch size must be ${LEGACY_MARVEL_BATCH_SIZE}.`);
  }
  const batches = [];
  for (let index = 0; index < records.length; index += batchSize) {
    batches.push(records.slice(index, index + batchSize));
  }
  return batches;
}
