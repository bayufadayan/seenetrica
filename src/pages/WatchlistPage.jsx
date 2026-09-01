import { useState } from "react";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { MovieCard } from "../components/common/MovieCard";
import { MovieCollectionTools } from "../components/common/MovieCollectionTools";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { sortTitles } from "../utils/title-sort";

export default function WatchlistPage() {
  useDocumentTitle("Watchlist");
  const { movies, loading, error } = useArchive();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("release-newest");
  const all = movies.filter((movie) => movie.status === "watchlist");
  const normalizedSearch = search.trim().toLowerCase();
  const shown = sortTitles(
    all.filter(
      (movie) =>
        (!normalizedSearch || `${movie.title} ${movie.original_title || ""}`.toLowerCase().includes(normalizedSearch)) &&
        (type === "all" || movie.media_type === type),
    ),
    sort,
  );
  return (
    <>
      <PageHero
        eyebrow=""
        title="Your"
        accent="watchlist."
        description="Released titles you are interested in, waiting until you press play."
        count={loading ? "—" : all.length}
        countLabel="saved titles"
      />
      <section className="page-content page-shell">
        <MovieCollectionTools
          collectionName="watchlist"
          placeholder="Search your watchlist"
          search={search}
          type={type}
          sort={sort}
          onSearchChange={setSearch}
          onTypeChange={setType}
          onSortChange={setSort}
        />
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
