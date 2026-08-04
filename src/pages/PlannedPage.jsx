import { useState } from "react";
import { Search } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { MovieCard } from "../components/common/MovieCard";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { formatDate } from "../utils/formatters";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function PlannedPage() {
  useDocumentTitle("Planned");
  const { movies, loading, error } = useArchive();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date");
  const all = movies.filter((movie) => movie.status === "plan");
  const shown = all
    .filter(
      (movie) =>
        !search || movie.title.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "added"
        ? String(b.created_at).localeCompare(String(a.created_at))
        : (a.release_date || "9999").localeCompare(b.release_date || "9999"),
    );
  return (
    <>
      <PageHero
        eyebrow="Stories on the horizon"
        title="Cinema"
        accent="plans."
        description="Upcoming releases that look interesting enough to meet on the big screen."
        count={loading ? "—" : all.length}
        countLabel="upcoming titles"
      />
      <section className="page-content page-shell">
        <div className="collection-tools">
          <label className="archive-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search planned titles</span>
            <input
              type="search"
              autoComplete="off"
              placeholder="Search planned titles"
              value={search}
              onChange={(e) => setSearch(e.target.value.trimStart())}
            />
          </label>
          <div
            className="tool-chips"
            role="group"
            aria-label="Sort planned titles"
          >
            {[
              ["date", "Release date"],
              ["added", "Recently added"],
            ].map(([value, label]) => (
              <button
                className={`chip-button ${sort === value ? "is-active" : ""}`}
                type="button"
                key={value}
                onClick={() => setSort(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
