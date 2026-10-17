import { Pencil, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "../components/common/PageHero";
import { Poster } from "../components/ui/Poster";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useArchive } from "../context/ArchiveContext";
import { countMoviesByTitle, normalizeMovieTitle } from "../features/movies/movie-duplicates.util";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./AllMoviesPage.css";

export default function AllMoviesPage() {
  useDocumentTitle("All Movies");
  const { movies, loading, error } = useArchive();
  const [search, setSearch] = useState("");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  const titleCounts = useMemo(() => countMoviesByTitle(movies), [movies]);
  const duplicateGroups = [...titleCounts.values()].filter((count) => count > 1);
  const duplicateRecords = duplicateGroups.reduce((sum, count) => sum + count, 0);
  const normalizedSearch = search.trim().toLowerCase();
  const statusLabels = {
    plan: "Planned",
    watchlist: "Watchlist",
    watched: "Watched",
    unlisted: "Unlisted",
  };

  const shown = [...movies]
    .filter((movie) => {
      const count = titleCounts.get(normalizeMovieTitle(movie.title)) || 0;
      return (
        (!duplicatesOnly || count > 1) &&
        (!normalizedSearch || String(movie.title || "").toLowerCase().includes(normalizedSearch))
      );
    })
    .sort((a, b) => {
      const aCount = titleCounts.get(normalizeMovieTitle(a.title)) || 0;
      const bCount = titleCounts.get(normalizeMovieTitle(b.title)) || 0;
      return (
        Number(bCount > 1) - Number(aCount > 1) ||
        String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" }) ||
        String(a.release_date || "").localeCompare(String(b.release_date || ""))
      );
    });

  return (
    <>
      <PageHero
        eyebrow=""
        title="All"
        accent="movies."
        description="Every saved title in one place, including titles from synced categories."
        count={loading ? "—" : movies.length}
        countLabel="movie records"
      />
      <section className="page-content page-shell all-movies-page">
        <div className="all-movies-tools">
          <label className="archive-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search all movies</span>
            <input
              type="search"
              autoComplete="off"
              placeholder="Search movie titles"
              value={search}
              onChange={(event) => setSearch(event.target.value.trimStart())}
            />
          </label>
          <button
            className={`all-movies-duplicate-filter ${duplicatesOnly ? "is-active" : ""}`}
            type="button"
            aria-pressed={duplicatesOnly}
            onClick={() => setDuplicatesOnly((value) => !value)}
          >
            Same titles only
          </button>
        </div>
        {loading ? (
          <LoadingState>Loading all movies…</LoadingState>
        ) : error ? (
          <ErrorState>The movie library could not be loaded.</ErrorState>
        ) : (
          <>
            <p className="collection-status" role="status">
              {shown.length} of {movies.length} records shown · {duplicateGroups.length} possible duplicate {duplicateGroups.length === 1 ? "title" : "titles"} ({duplicateRecords} records)
            </p>
            {duplicateGroups.length > 0 && (
              <p className="all-movies-note">
                Matches use the movie title only. Different releases may share the same name, so these are possible duplicates—not confirmed copies.
              </p>
            )}
            <div className="all-movies-list">
              {shown.map((movie) => {
                const duplicateCount = titleCounts.get(normalizeMovieTitle(movie.title)) || 0;
                const detailPath = `/movies/${encodeURIComponent(movie.id)}`;

                return (
                  <article className="all-movies-row" key={movie.id}>
                    <Link className="all-movies-poster" to={detailPath} state={{ from: "/movies" }} aria-label={`View ${movie.title} details`}>
                      <Poster src={movie.poster_url} alt="" loading="lazy" />
                    </Link>
                    <div className="all-movies-info">
                      <Link className="all-movies-title" to={detailPath} state={{ from: "/movies" }}>{movie.title}</Link>
                      <p className="all-movies-meta">
                        {movie.media_type === "series" ? "Series" : "Movie"} · {movie.release_date?.slice(0, 4) || "Year unknown"} · {statusLabels[movie.status] || movie.status || "Unknown status"}
                      </p>
                      {duplicateCount > 1 && (
                        <span className="all-movies-duplicate-label">
                          Possible duplicate · {duplicateCount} records
                        </span>
                      )}
                    </div>
                    <Link className="secondary-button all-movies-edit" to={`${detailPath}#movie-edit`} state={{ from: "/movies" }}>
                      <Pencil aria-hidden="true" />
                      Edit
                    </Link>
                  </article>
                );
              })}
            </div>
            {!shown.length && (
              <>
                <EmptyState>
                  {movies.length === 0
                    ? "Your movie library is empty. Add a movie to get started."
                    : duplicatesOnly && duplicateGroups.length === 0
                      ? "No matching titles were found in the library."
                      : "No movies match your search or filter. Clear the search or turn off the filter."}
                </EmptyState>
                {movies.length === 0 && <Link className="secondary-button all-movies-add" to="/add-movie">Add Movie</Link>}
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
