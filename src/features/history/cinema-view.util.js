import { booleanValue } from "../../utils/formatters";

export function buildCinemaEntries(movies, history) {
  const map = new Map(movies.map((movie) => [String(movie.id), movie]));
  return history
    .filter((entry) => booleanValue(entry.watched_in_theater))
    .map((entry) => ({ ...entry, movie: map.get(String(entry.movie_id)) }))
    .filter((entry) => entry.movie)
    .sort((left, right) =>
      String(right.watched_at).localeCompare(String(left.watched_at))
      || String(right.created_at).localeCompare(String(left.created_at)),
    );
}
