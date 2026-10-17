import { useState } from "react";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { MovieCollectionTools } from "../components/common/MovieCollectionTools";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { ReleaseMonthSection } from "../features/movies/release/ReleaseMonthSection";
import { groupMoviesByReleaseMonth } from "../features/movies/release/release-groups";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "../features/movies/release/release.css";

export default function PlannedPage() {
  useDocumentTitle("Planned");
  const { movies, loading, error } = useArchive();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const all = movies.filter((movie) => movie.status === "plan");
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
        title="Cinema"
        accent="plans."
        description="A release journey, month by month. Scroll sideways to explore each timeline."
        count={loading ? "—" : all.length}
        countLabel="planned titles"
      />
      <section className="page-content page-shell release-collection-page">
        <MovieCollectionTools
          collectionName="planned titles"
          placeholder="Search planned titles"
          search={search}
          type={type}
          onSearchChange={setSearch}
          onTypeChange={setType}
          showSort={false}
        />
        {loading ? (
          <LoadingState>Loading plans…</LoadingState>
        ) : error ? (
          <ErrorState>The planned list could not be loaded.</ErrorState>
        ) : (
          <>
            <p className="collection-status" role="status">{shown.length} {shown.length === 1 ? "title" : "titles"} shown · oldest releases first</p>
            {groups.length ? (
              <div className="release-month-list">
                {groups.map((group) => <ReleaseMonthSection key={group.key} group={group} timeline />)}
              </div>
            ) : (
              <EmptyState>No planned titles match this view.</EmptyState>
            )}
          </>
        )}
      </section>
    </>
  );
}
