import { normalizeMovieTitle } from "./movie-duplicates.util";

export function findMoviesByIdentity(movies, title) {
  if (!title?.external_id || title.external_source === "manual") return [];

  return movies.filter((movie) =>
    movie.external_source === "tmdb" &&
    Number(movie.external_id) === Number(title.external_id) &&
    movie.media_type === title.media_type &&
    Number(movie.season_number || 0) === Number(title.season_number || 0),
  );
}

export function findMoviesWithSameTitle(movies, title) {
  const normalized = normalizeMovieTitle(title);
  return normalized
    ? movies.filter((movie) => normalizeMovieTitle(movie.title) === normalized)
    : [];
}
