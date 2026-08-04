const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function getTmdbImageUrl(path, size = "w780", fallback = "/assets/favicon.svg") {
  if (!path) return fallback;
  return `${TMDB_IMAGE_BASE}/${size}/${String(path).replace(/^\//, "")}`;
}
