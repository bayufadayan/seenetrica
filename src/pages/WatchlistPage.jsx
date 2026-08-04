import { useState } from "react";
import { Search } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { MovieCard } from "../components/common/MovieCard";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function WatchlistPage() {
  useDocumentTitle("Watchlist");
  const { movies, loading, error } = useArchive();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const all = movies.filter((movie) => movie.status === "watchlist");
  const shown = all
    .filter(
      (movie) =>
        (!search || movie.title.toLowerCase().includes(search.toLowerCase())) &&
        (!type || movie.media_type === type),
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return (
    <>
      <PageHero
        eyebrow="Saved for the right night"
        title="Your"
        accent="watchlist."
        description="Released titles you are interested in, waiting until you press play."
        count={loading ? "—" : all.length}
        countLabel="saved titles"
      />
      <section className="page-content page-shell">
        <div className="collection-tools">
          <label className="archive-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search watchlist</span>
            <input
              type="search"
              autoComplete="off"
              placeholder="Search your watchlist"
              value={search}
              onChange={(e) => setSearch(e.target.value.trimStart())}
            />
          </label>
          <div
            className="tool-chips"
            role="group"
            aria-label="Media type filters"
          >
            {[
              ["", "All"],
              ["movie", "Movies"],
              ["series", "Series"],
            ].map(([value, label]) => (
              <button
                className={`chip-button ${type === value ? "is-active" : ""}`}
                type="button"
                key={label}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <LoadingState>Loading watchlist…</LoadingState>
        ) : error ? (
          <ErrorState>The watchlist could not be loaded.</ErrorState>
        ) : (
          <>
            <p className="collection-status" role="status">
              {shown.length} {shown.length === 1 ? "title" : "titles"} shown
            </p>
            <div className="collection-grid">
              {shown.length ? (
                shown.map((movie) => (
                  <MovieCard
                    movie={movie}
                    key={movie.id}
                    subtitle={`${movie.media_type} · ${movie.runtime_minutes ? `${movie.runtime_minutes} min` : movie.release_date?.slice(0, 4) || "TBA"}`}
                  />
                ))
              ) : (
                <EmptyState>No watchlist titles match this view.</EmptyState>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
