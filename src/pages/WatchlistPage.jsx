import { useState } from "react";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { MovieCollectionTools } from "../components/common/MovieCollectionTools";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { ReleaseMonthSection } from "../features/movies/release/ReleaseMonthSection";
import { groupMoviesByReleaseMonth } from "../features/movies/release/release-groups";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "../features/movies/release/release.css";

export default function WatchlistPage() {
  useDocumentTitle("Watchlist");
  const { movies, loading, error } = useArchive();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const all = movies.filter((movie) => movie.status === "watchlist");
  const normalizedSearch = search.trim().toLowerCase();
  const shown = all.filter(
    (movie) =>
      (!normalizedSearch || `${movie.title} ${movie.original_title || ""}`.toLowerCase().includes(normalizedSearch)) &&
      (type === "all" || movie.media_type === type),
  );
  const groups = groupMoviesByReleaseMonth(shown);

  return (
    <>
      <PageHero
        eyebrow=""
        title="Your"
        accent="watchlist."
        description="Saved titles, organized by their release month."
        count={loading ? "—" : all.length}
        countLabel="saved titles"
      />
      <section className="page-content page-shell release-collection-page">
        <MovieCollectionTools
          collectionName="watchlist"
          placeholder="Search your watchlist"
          search={search}
          type={type}
          onSearchChange={setSearch}
          onTypeChange={setType}
          showSort={false}
        />
        {loading ? (
          <LoadingState>Loading watchlist…</LoadingState>
        ) : error ? (
          <ErrorState>The watchlist could not be loaded.</ErrorState>
        ) : (
          <>
            <p className="collection-status" role="status">{shown.length} {shown.length === 1 ? "title" : "titles"} shown</p>
            {groups.length ? (
              <div className="release-month-list">
                {groups.map((group) => <ReleaseMonthSection key={group.key} group={group} />)}
              </div>
            ) : (
              <EmptyState>No watchlist titles match this view.</EmptyState>
            )}
          </>
        )}
      </section>
    </>
  );
}
