import { useState } from "react";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { MovieCard } from "../components/common/MovieCard";
import { MovieCollectionTools } from "../components/common/MovieCollectionTools";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { formatDate } from "../utils/formatters";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { sortTitles } from "../utils/title-sort";

export default function PlannedPage() {
  useDocumentTitle("Planned");
  const { movies, loading, error } = useArchive();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("release-newest");
  const all = movies.filter((movie) => movie.status === "plan");
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
        title="Cinema"
        accent="plans."
        description="Upcoming releases that look interesting enough to meet on the big screen."
        count={loading ? "—" : all.length}
        countLabel="upcoming titles"
      />
      <section className="page-content page-shell">
        <MovieCollectionTools
          collectionName="planned titles"
          placeholder="Search planned titles"
          search={search}
          type={type}
          sort={sort}
          onSearchChange={setSearch}
          onTypeChange={setType}
          onSortChange={setSort}
        />
        {loading ? (
          <LoadingState>Loading plans…</LoadingState>
        ) : error ? (
          <ErrorState>The planned list could not be loaded.</ErrorState>
        ) : (
          <>
            <p className="collection-status" role="status">
              {shown.length} upcoming {shown.length === 1 ? "title" : "titles"}{" "}
              shown
            </p>
            <div className="collection-grid">
              {shown.length ? (
                shown.map((movie) => (
                  <MovieCard
                    movie={movie}
                    key={movie.id}
                    subtitle={`${movie.media_type} · ${movie.release_date ? `Releases ${formatDate(movie.release_date)}` : "Release date TBA"}`}
                    dateBadge={
                      movie.release_date
                        ? formatDate(movie.release_date, { year: "2-digit" })
                        : "TBA"
                    }
                  />
                ))
              ) : (
                <EmptyState>No planned titles match this view.</EmptyState>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
