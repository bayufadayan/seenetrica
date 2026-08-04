function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function createTitleIdentityKey({ type, tmdbId, seasonNumber }) {
  const externalId = positiveInteger(tmdbId);
  if (!externalId) throw new Error("A valid TMDB ID is required.");
  if (type === "movie") return `movie:${externalId}`;
  if (type !== "series") throw new Error("Type must be movie or series.");
  const season = positiveInteger(seasonNumber);
  return season
    ? `series:${externalId}:season:${season}`
    : `series:${externalId}:whole`;
}

function commonDraft(details) {
  return {
    tmdbId: Number(details.external_id),
    originalTitle: details.original_title || details.title,
    releaseDate: details.release_date || null,
    posterPath: details.poster_path || null,
    backdropPath: details.backdrop_path || null,
    runtimeMinutes: Number(details.runtime_minutes) > 0
      ? Number(details.runtime_minutes)
      : null,
    isWatched: false,
    prerequisiteIds: [],
  };
}

export function createMovieDraft(details) {
  const title = String(details?.title || "").trim();
  if (!title) throw new Error("TMDB did not return a title for this movie.");
  const draft = {
    ...commonDraft(details),
    type: "movie",
    baseTitle: title,
    title,
    seasonNumber: null,
    seasonTmdbId: null,
  };
  return { ...draft, identityKey: createTitleIdentityKey(draft) };
}

export function createWholeSeriesDraft(details) {
  const title = String(details?.title || "").trim();
  if (!title) throw new Error("TMDB did not return a title for this series.");
  const draft = {
    ...commonDraft(details),
    type: "series",
    baseTitle: title,
    title,
    seasonNumber: null,
    seasonTmdbId: null,
  };
  return { ...draft, identityKey: createTitleIdentityKey(draft) };
}

export function createSeasonDrafts(details, firstSeason, lastSeason) {
  const first = positiveInteger(firstSeason);
  const last = positiveInteger(lastSeason);
  if (!first || !last || last < first) {
    throw new Error("Choose a valid season range.");
  }
  const baseTitle = String(details?.title || "").trim();
  if (!baseTitle) throw new Error("TMDB did not return a title for this series.");
  const seasons = Array.isArray(details.seasons)
    ? details.seasons
        .filter((season) => positiveInteger(season.season_number))
        .sort((left, right) => left.season_number - right.season_number)
    : [];
  if (!seasons.length) {
    throw new Error("Season information is unavailable for this series. Add it as a single series instead.");
  }
  const maximum = Math.max(...seasons.map((season) => Number(season.season_number)));
  if (last > maximum) throw new Error(`Last season cannot be greater than ${maximum}.`);

  const unique = new Map();
  for (const season of seasons) {
    const seasonNumber = positiveInteger(season.season_number);
    if (!seasonNumber || seasonNumber < first || seasonNumber > last || unique.has(seasonNumber)) continue;
    const draft = {
      ...commonDraft(details),
      type: "series",
      baseTitle,
      title: `${baseTitle} S${seasonNumber}`,
      seasonNumber,
      seasonTmdbId: positiveInteger(season.id),
      releaseDate: season.air_date || details.release_date || null,
      posterPath: season.poster_path || details.poster_path || null,
      backdropPath: details.backdrop_path || null,
    };
    unique.set(seasonNumber, {
      ...draft,
      identityKey: createTitleIdentityKey(draft),
    });
  }
  if (!unique.size) throw new Error("No seasons in this range are available from TMDB.");
  return [...unique.values()];
}

export function normalizeLegacyTitle(record) {
  const type = record?.type === "series" ? "series" : "movie";
  const tmdbId = positiveInteger(record?.tmdbId);
  const seasonNumber = type === "series" ? positiveInteger(record?.seasonNumber) : null;
  const baseTitle = String(record?.baseTitle || record?.title || "Untitled").trim() || "Untitled";
  let identityKey;
  try {
    identityKey = createTitleIdentityKey({ type, tmdbId, seasonNumber });
  } catch {
    identityKey = `legacy:${record?.id || "unknown"}`;
  }
  return {
    ...record,
    type,
    baseTitle,
    seasonNumber,
    seasonTmdbId: seasonNumber ? positiveInteger(record?.seasonTmdbId) : null,
    prerequisiteIds: [...new Set(Array.isArray(record?.prerequisiteIds) ? record.prerequisiteIds.filter(Boolean) : [])],
    identityKey,
  };
}
