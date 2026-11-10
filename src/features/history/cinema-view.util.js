import { booleanValue } from "../../utils/formatters";
import { annotateRewatchNumbers } from "./rewatch.util";

export function buildCinemaEntries(movies, history) {
  const map = new Map(movies.map((movie) => [String(movie.id), movie]));
  return annotateRewatchNumbers(history)
    .filter((entry) => booleanValue(entry.watched_in_theater))
    .map((entry) => ({ ...entry, movie: map.get(String(entry.movie_id)) }))
    .filter((entry) => entry.movie)
    .sort((left, right) =>
      String(right.watched_at).localeCompare(String(left.watched_at))
      || String(right.created_at).localeCompare(String(left.created_at)),
    );
}

export function filterCinemaEntries(entries, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return entries;

  return entries.filter((entry) =>
    `${entry.movie.title} ${entry.movie.original_title || ""}`
      .toLowerCase()
      .includes(normalizedQuery),
  );
}
