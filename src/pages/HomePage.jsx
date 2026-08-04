import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { joinHistory, HistoryGroups } from "../features/history/HistoryGroups";
import { Poster } from "../components/ui/Poster";
import { ErrorState, LoadingState } from "../components/ui/States";
import { formatDate } from "../utils/formatters";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function HomePage() {
  useDocumentTitle("");
  const { movies, history, loading, error } = useArchive();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    date: "",
    month: "",
    year: "",
  });
  const [page, setPage] = useState(1);
  const searchRef = useRef(null);
  useEffect(() => {
    const keydown = (event) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        )
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, []);

  const allEntries = useMemo(
    () => joinHistory(movies, history),
    [movies, history],
  );
  const entries = useMemo(
    () =>
      allEntries
        .filter((entry) => {
          const [year, month] = entry.watched_at.split("-");
          return (
            (!filters.search ||
              entry.movie.title
                .toLowerCase()
                .includes(filters.search.toLowerCase())) &&
            (!filters.date || entry.watched_at === filters.date) &&
            (!filters.month || month === filters.month) &&
            (!filters.year || year === filters.year)
          );
        })
        .sort((a, b) => b.watched_at.localeCompare(a.watched_at)),
    [allEntries, filters],
  );
  const monthKeys = [
    ...new Set(entries.map((entry) => entry.watched_at.slice(0, 7))),
  ];
  const totalPages = Math.max(1, Math.ceil(monthKeys.length / 6));
  const visibleMonths = new Set(monthKeys.slice((page - 1) * 6, page * 6));
  const visibleEntries = entries.filter((entry) =>
    visibleMonths.has(entry.watched_at.slice(0, 7)),
  );
  const years = [
    ...new Set(allEntries.map((entry) => entry.watched_at.slice(0, 4))),
  ]
    .sort()
    .reverse();
  const planned = movies
    .filter((movie) => movie.status === "plan")
    .sort((a, b) =>
      (a.release_date || "9999").localeCompare(b.release_date || "9999"),
    );
  const watchlist = movies
    .filter((movie) => movie.status === "watchlist")
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }
  function clear() {
    setFilters({ search: "", date: "", month: "", year: "" });
    setPage(1);
  }

  return (
    <>
      <section className="hero page-shell" aria-labelledby="hero-title">
        <div className="hero-inner">
          <div className="hero-copy">
            <h1 id="hero-title">
              Your films, <span>remembered.</span>
            </h1>
            <p className="hero-description">
              Keep the stories you watched, the ones waiting for you, and the
              moments that made each screening matter.
            </p>
            <Link className="primary-button" to="/add-movie">
              <Plus aria-hidden="true" />
              Add a movie
            </Link>
          </div>
          <div className="hero-note" aria-label="Archive summary">
            <span className="hero-note-number">
              {loading
                ? "—"
                : movies.filter((movie) => movie.status === "watched").length}
            </span>
            <span className="hero-note-label">titles watched</span>
            <span className="hero-note-rule" aria-hidden="true" />
            <span className="hero-note-caption">
              One archive. Every impression.
            </span>
          </div>
        </div>
      </section>
      <section
        className="archive-search-section page-shell"
        aria-label="Search"
      >
        <label className="archive-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search watched titles</span>
          <input
            ref={searchRef}
            type="search"
            autoComplete="off"
            placeholder="Search your watch history"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value.trimStart())}
          />
          <kbd>/</kbd>
        </label>
      </section>
      <section className="home-content page-shell">
        <div className="history-panel">
          <div className="history-heading">
            <h2 className="section-title">Recently watched</h2>
            <button
              className="filter-toggle"
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filters
            </button>
          </div>
          <div className={`history-filters ${filtersOpen ? "is-open" : ""}`}>
            <label>
              <span>Specific date</span>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilter("date", e.target.value)}
              />
            </label>
            <label>
              <span>Month</span>
              <select
                value={filters.month}
                onChange={(e) => setFilter("month", e.target.value)}
              >
                <MonthOptions />
              </select>
            </label>
            <label>
              <span>Year</span>
              <select
                value={filters.year}
                onChange={(e) => setFilter("year", e.target.value)}
              >
                <option value="">All years</option>
                {years.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
            <button className="text-button" type="button" onClick={clear}>
              Clear filters
            </button>
          </div>
          {loading ? (
            <LoadingState>Loading your archive…</LoadingState>
          ) : error ? (
            <ErrorState>The archive could not be loaded.</ErrorState>
          ) : (
            <div className="history-groups">
              <HistoryGroups
                entries={visibleEntries}
                page={page}
                totalPages={totalPages}
                onPage={setPage}
              />
            </div>
          )}
          <Link className="section-link" to="/history">
            View complete history
          </Link>
        </div>
        <aside className="home-aside" aria-label="Saved titles">
          <CompactSection
            title="Planned"
            items={planned}
            planned
            to="/planned"
          />
          <CompactSection
            title="Watchlist"
            items={watchlist}
            to="/watchlist"
          />
        </aside>
      </section>
    </>
  );
}

function CompactSection({ title, items, planned = false, to }) {
  return (
    <section className="aside-section">
      <div className="aside-heading">
        <h2>{title}</h2>
        <Link to={to}>View all</Link>
      </div>
      <div className="compact-list">
        {items.length ? (
          items.slice(0, 3).map((movie) => (
            <Link
              className="compact-card"
              to={`/movies/${encodeURIComponent(movie.id)}`}
              key={movie.id}
            >
              <div className="compact-poster">
                <Poster src={movie.poster_url} alt="" loading="lazy" />
              </div>
              <div className="compact-copy">
                <h3>{movie.title}</h3>
                <p>
                  {planned
                    ? formatDate(movie.release_date, {
                        fallback: "Release date TBA",
                      })
                    : `${movie.media_type} · ${movie.runtime_minutes ? `${movie.runtime_minutes} min` : "Runtime TBA"}`}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <p className="compact-loading">
            No {planned ? "planned" : "watchlist"} titles yet.
          </p>
        )}
      </div>
    </section>
  );
}

export function MonthOptions() {
  return (
    <>
      <option value="">All months</option>
      {[
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ].map((month, index) => (
        <option value={String(index + 1).padStart(2, "0")} key={month}>
          {month}
        </option>
      ))}
    </>
  );
}
