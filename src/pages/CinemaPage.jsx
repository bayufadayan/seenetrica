import { ArrowUpRight, Plus, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { Poster } from "../components/ui/Poster";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { booleanValue, formatDate, formatRuntime } from "../utils/formatters";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function CinemaPage() {
  useDocumentTitle("Cinema Diary");
  const { movies, history, loading, error } = useArchive();
  const map = new Map(movies.map((movie) => [String(movie.id), movie]));
  const entries = history
    .filter((entry) => booleanValue(entry.watched_in_theater))
    .map((entry) => ({ ...entry, movie: map.get(String(entry.movie_id)) }))
    .filter((entry) => entry.movie)
    .sort(
      (a, b) =>
        String(b.watched_at).localeCompare(String(a.watched_at)) ||
        String(b.created_at).localeCompare(String(a.created_at)),
    );
  return (
    <>
      <PageHero
        eyebrow="Big screens, remembered"
        title="Cinema"
        accent="diary."
        description="Every title watched in a theater, listed from the latest screening backward."
        count={loading ? "—" : entries.length}
        countLabel="theater visits"
      />
      <section className="page-content page-shell cinema-page-content">
        <div className="cinema-section-heading">
          <h2 className="section-title">Latest screenings</h2>
          <div className="cinema-section-actions">
            <p className="collection-status" role="status">
              {loading
                ? "Loading cinema diary…"
                : `${entries.length} ${entries.length === 1 ? "screening" : "screenings"} recorded`}
            </p>
            <Link
              className="primary-button cinema-add-button"
              to="/add-movie?intent=theater"
            >
              <Plus aria-hidden="true" />
              Add Screening
            </Link>
          </div>
        </div>
        {loading ? (
          <LoadingState>Loading cinema diary…</LoadingState>
        ) : error ? (
          <ErrorState>The cinema diary could not be loaded.</ErrorState>
        ) : (
          <div className="cinema-list">
            {entries.length ? (
              entries.map((entry, index) => (
                <Link
                  className="cinema-entry"
                  to={`/movies/${encodeURIComponent(entry.movie.id)}`}
                  key={entry.id}
                  aria-label={`Open ${entry.movie.title} details`}
                >
                  <span className="cinema-entry-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="cinema-entry-poster">
                    <Poster
                      src={entry.movie.poster_url}
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="cinema-entry-copy">
                    <p>
                      {entry.movie.media_type === "series" ? "Series" : "Movie"}{" "}
                      · {formatRuntime(entry.movie.runtime_minutes)}
                    </p>
                    <h2>{entry.movie.title}</h2>
                    <span>
                      <Ticket aria-hidden="true" />
                      Watched on the big screen
                    </span>
                  </div>
                  <div className="cinema-entry-date">
                    <span>Watched</span>
                    <time dateTime={String(entry.watched_at).slice(0, 10)}>
                      {formatDate(entry.watched_at, {
                        fallback: "Date unknown",
                        month: "long",
                      })}
                    </time>
                  </div>
                  <ArrowUpRight
                    className="cinema-entry-arrow"
                    aria-hidden="true"
                  />
                </Link>
              ))
            ) : (
              <EmptyState>
                No theater viewings have been recorded yet.
              </EmptyState>
            )}
          </div>
        )}
      </section>
    </>
  );
}
