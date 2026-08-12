function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function categoryFromApi(record) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    iconUrl: record.icon_url || null,
    iconPublicId: record.icon_public_id || null,
    sortOrder: Number(record.sort_order) || 0,
    legacyMigrationCompletedAt: record.legacy_migration_completed_at || null,
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
    deletedAt: record.deleted_at || null,
  };
}

export function categoryToApi(record) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    icon_url: record.iconUrl || null,
    icon_public_id: record.iconPublicId || null,
    sort_order: Number(record.sortOrder) || 0,
    legacy_migration_completed_at: record.legacyMigrationCompletedAt || null,
    created_at: record.createdAt || null,
    updated_at: record.updatedAt || null,
    deleted_at: record.deletedAt || null,
  };
}

export function categoryTitleFromApi(record) {
  return {
    id: record.id,
    categoryId: record.category_id,
    tmdbId: nullableNumber(record.tmdb_id),
    title: record.title,
    baseTitle: record.base_title || record.title,
    originalTitle: record.original_title || record.title,
    releaseDate: record.release_date || null,
    type: record.media_type,
    seasonNumber: nullableNumber(record.season_number),
    seasonTmdbId: nullableNumber(record.season_tmdb_id),
    identityKey: record.identity_key,
    isWatched: Boolean(record.is_watched),
    prerequisiteIds: Array.isArray(record.prerequisite_ids) ? record.prerequisite_ids : [],
    posterPath: record.poster_path || null,
    backdropPath: record.backdrop_path || null,
    runtimeMinutes: nullableNumber(record.runtime_minutes),
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
    deletedAt: record.deleted_at || null,
  };
}

export function categoryTitleToApi(record) {
  return {
    id: record.id,
    category_id: record.categoryId,
    tmdb_id: record.tmdbId,
    title: record.title,
    base_title: record.baseTitle,
    original_title: record.originalTitle,
    release_date: record.releaseDate || null,
    media_type: record.type,
    season_number: record.seasonNumber ?? null,
    season_tmdb_id: record.seasonTmdbId ?? null,
    identity_key: record.identityKey,
    is_watched: Boolean(record.isWatched),
    prerequisite_ids: record.prerequisiteIds || [],
    poster_path: record.posterPath || null,
    backdrop_path: record.backdropPath || null,
    runtime_minutes: record.runtimeMinutes ?? null,
    created_at: record.createdAt || null,
    updated_at: record.updatedAt || null,
    deleted_at: record.deletedAt || null,
  };
}

export function categorySnapshotFromApi(data = {}) {
  return {
    categories: Array.isArray(data.categories) ? data.categories.map(categoryFromApi) : [],
    titles: Array.isArray(data.category_titles) ? data.category_titles.map(categoryTitleFromApi) : [],
    legacyMarvelMigrationCompletedAt:
      data.category_sync?.legacy_marvel_migration_completed_at
      || data.legacy_marvel_migration_completed_at
      || null,
    serverTime: data.category_sync?.server_time || data.server_time || null,
  };
}
