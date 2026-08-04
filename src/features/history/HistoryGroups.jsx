import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { MovieCard } from "../../components/common/MovieCard";
import { EmptyState } from "../../components/ui/States";
import { formatDate, formatMonth } from "../../utils/formatters";

export function HistoryGroups({
  entries,
  grouped = true,
  page,
  totalPages,
  onPage,
}) {
  if (!entries.length)
    return <EmptyState>No history entries match this view.</EmptyState>;
  if (!grouped) {
    return (
      <div className="collection-grid history-ungrouped-grid">
        {entries.map((entry) => (
          <HistoryCard entry={entry} key={entry.id} />
        ))}
      </div>
    );
  }
  const groups = entries.reduce((result, entry) => {
    const key = entry.watched_at.slice(0, 7);
    (result[key] ||= []).push(entry);
    return result;
  }, {});
  return (
    <>
      {Object.entries(groups).map(([period, monthEntries]) => (
        <section className="month-group" key={period}>
          <div className="month-heading">
            <h3>{formatMonth(period)}</h3>
            <span>
              {monthEntries.length}{" "}
              {monthEntries.length === 1 ? "entry" : "entries"}
            </span>
            <Link
              className="group-add-button"
              to={`/add-movie?intent=watched&period=${period}`}
              aria-label={`Add a watched title to ${formatMonth(period)}`}
              title={`Add to ${formatMonth(period)}`}
            >
              <Plus aria-hidden="true" />
            </Link>
          </div>
          <div className="collection-grid movie-grid">
            {monthEntries.map((entry) => (
              <HistoryCard entry={entry} key={entry.id} />
            ))}
          </div>
        </section>
      ))}
      {totalPages > 1 && (
        <nav className="form-actions" aria-label="Watch history pagination">
          <button
            className="secondary-button"
            type="button"
            disabled={page === 1}
            onClick={() => onPage(page - 1)}
          >
            <ArrowLeft aria-hidden="true" />
            Previous
          </button>
          <span className="rating">
            Page {page} of {totalPages}
          </span>
          <button
            className="secondary-button"
            type="button"
            disabled={page === totalPages}
            onClick={() => onPage(page + 1)}
          >
            Next
            <ArrowRight aria-hidden="true" />
          </button>
        </nav>
      )}
    </>
  );
}

function HistoryCard({ entry }) {
  return (
    <MovieCard
      movie={entry.movie}
      inTheater={
        entry.watched_in_theater === true ||
        String(entry.watched_in_theater).toLowerCase() === "true"
      }
      subtitle={`${entry.movie.media_type} · ${formatDate(entry.watched_at)}`}
    />
  );
}

export function joinHistory(movies, history) {
  const movieMap = new Map(movies.map((movie) => [String(movie.id), movie]));
  return history
    .map((entry) => ({
      ...entry,
      watched_at: String(entry.watched_at || "").slice(0, 10),
      movie: movieMap.get(String(entry.movie_id)),
    }))
    .filter(
      (entry) => entry.movie && /^\d{4}-\d{2}-\d{2}$/.test(entry.watched_at),
    );
}
