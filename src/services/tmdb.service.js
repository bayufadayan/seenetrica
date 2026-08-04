import { parseJson } from "./http";

function normalizeSeason(season, fallbackPosterPath) {
  const seasonNumber = Number(season?.season_number);
  if (!Number.isInteger(seasonNumber) || seasonNumber <= 0) return null;
  const posterPath = season.poster_path || fallbackPosterPath || null;
  return {
    id: Number(season.id) || null,
    season_number: seasonNumber,
    name: season.name || `Season ${seasonNumber}`,
    air_date: season.air_date || null,
    episode_count: Math.max(0, Number(season.episode_count) || 0),
    poster_path: posterPath,
    poster_url: season.poster_url || (posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null),
  };
}

export function normalizeTmdbDetails(payload) {
  const type = payload?.media_type === "series" ? "series" : "movie";
  const seasons = type === "series" && Array.isArray(payload.seasons)
    ? payload.seasons
        .map((season) => normalizeSeason(season, payload.poster_path))
        .filter(Boolean)
        .sort((left, right) => left.season_number - right.season_number)
    : [];
  return {
    ...payload,
    external_id: Number(payload?.external_id),
    title: String(payload?.title || "").trim(),
    original_title: payload?.original_title || payload?.title || "",
    media_type: type,
    release_date: payload?.release_date || null,
    poster_path: payload?.poster_path || null,
    backdrop_path: payload?.backdrop_path || null,
    runtime_minutes: Number(payload?.runtime_minutes) > 0 ? Number(payload.runtime_minutes) : null,
    number_of_seasons: type === "series" ? Math.max(0, Number(payload?.number_of_seasons) || seasons.length) : null,
    seasons,
  };
}

export const tmdbService = {
  async search(query, page = 1) {
    const params = new URLSearchParams({ q: query, page: String(page) });
    const response = await fetch(`/api/tmdb/search?${params}`);
    const payload = await parseJson(response);
    return {
      results: Array.isArray(payload.results) ? payload.results : [],
      page: Number(payload.page) || page,
      totalPages: Math.max(1, Number(payload.total_pages) || 1),
    };
  },

  async getDetails(id, type) {
    const params = new URLSearchParams({ id: String(id), type });
    const response = await fetch(`/api/tmdb/details?${params}`);
    return normalizeTmdbDetails(await parseJson(response));
  },
};
