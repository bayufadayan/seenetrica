import { createTitleIdentityKey } from "./title-draft.util";

function now() {
  return new Date().toISOString();
}

function createId(prefix) {
  return crypto.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function dependsOn(sourceId, targetId, titleMap, visited = new Set()) {
  if (sourceId === targetId) return true;
  if (visited.has(sourceId)) return false;
  visited.add(sourceId);
  const source = titleMap.get(sourceId);
  return (source?.prerequisiteIds || []).some((nextId) =>
    dependsOn(nextId, targetId, titleMap, visited),
  );
}

export function normalizeCategoryTitle(categoryId, payload, existing = null) {
  if (!categoryId) throw new Error("Category is required.");
  if (!payload?.title?.trim()) throw new Error("Title is required.");
  if (!Number.isFinite(Number(payload.tmdbId))) throw new Error("A valid TMDB ID is required.");
  if (!["movie", "series"].includes(payload.type)) throw new Error("Type must be movie or series.");

  const type = payload.type;
  const seasonValue = Number(payload.seasonNumber);
  const seasonNumber = type === "series" && Number.isInteger(seasonValue) && seasonValue > 0
    ? seasonValue
    : null;
  const timestamp = now();
  const title = payload.title.trim();
  const baseTitle = String(payload.baseTitle || existing?.baseTitle || title).trim();
  const prerequisiteIds = [...new Set(
    (Array.isArray(payload.prerequisiteIds) ? payload.prerequisiteIds : []).filter(Boolean),
  )];

  return {
    ...(existing || {}),
    id: existing?.id || payload.id || createId("category-title"),
    categoryId,
    tmdbId: Number(payload.tmdbId),
    title,
    baseTitle,
    originalTitle: String(payload.originalTitle || title).trim(),
    releaseDate: payload.releaseDate || null,
    type,
    seasonNumber,
    seasonTmdbId: seasonNumber && Number(payload.seasonTmdbId) > 0
      ? Number(payload.seasonTmdbId)
      : null,
    identityKey: existing?.identityKey || payload.identityKey || createTitleIdentityKey({
      type,
      tmdbId: payload.tmdbId,
      seasonNumber,
    }),
    isWatched: Boolean(payload.isWatched),
    prerequisiteIds,
    posterPath: payload.posterPath || null,
    backdropPath: payload.backdropPath || null,
    runtimeMinutes: Number(payload.runtimeMinutes) > 0 ? Number(payload.runtimeMinutes) : null,
    createdAt: existing?.createdAt || payload.createdAt || timestamp,
    updatedAt: timestamp,
    deletedAt: payload.deletedAt ?? existing?.deletedAt ?? null,
  };
}

export function validateCategoryTitleRelationships(records, allTitles) {
  const categories = new Set(records.map((record) => record.categoryId));
  if (categories.size !== 1) throw new Error("A title batch must belong to one category.");
  const categoryId = records[0]?.categoryId;
  const active = allTitles.filter((title) => title.categoryId === categoryId && !title.deletedAt);
  const titleMap = new Map(active.map((title) => [title.id, title]));
  for (const record of records) titleMap.set(record.id, record);

  for (const record of records) {
    if (record.prerequisiteIds.includes(record.id)) {
      throw new Error("A title cannot require itself.");
    }
    for (const prerequisiteId of record.prerequisiteIds) {
      const prerequisite = titleMap.get(prerequisiteId);
      if (!prerequisite || prerequisite.categoryId !== categoryId || prerequisite.deletedAt) {
        throw new Error("Prerequisites must be active titles in the same category.");
      }
      if (dependsOn(prerequisiteId, record.id, titleMap)) {
        throw new Error("This prerequisite would create a circular dependency.");
      }
    }
  }
}

export function assertUniqueCategoryIdentities(records, allTitles, ignoredIds = []) {
  const ignored = new Set(ignoredIds);
  const existing = new Set(
    allTitles
      .filter((title) => !title.deletedAt && !ignored.has(title.id))
      .map((title) => `${title.categoryId}::${title.identityKey}`),
  );
  const batch = new Set();
  for (const record of records) {
    const key = `${record.categoryId}::${record.identityKey}`;
    if (existing.has(key)) throw new Error(`${record.title} is already in this category.`);
    if (batch.has(key)) throw new Error(`${record.title} appears more than once in this batch.`);
    batch.add(key);
  }
}
