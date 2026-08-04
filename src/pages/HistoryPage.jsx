import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { ErrorState, LoadingState } from "../components/ui/States";
import { HistoryGroups, joinHistory } from "../features/history/HistoryGroups";
import { MonthOptions } from "./HomePage";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function HistoryPage() {
  useDocumentTitle("History");
  const { movies, history, loading, error } = useArchive();
  const allEntries = useMemo(
    () => joinHistory(movies, history),
    [movies, history],
  );
  const years = [
    ...new Set(allEntries.map((entry) => entry.watched_at.slice(0, 4))),
  ]
    .sort()
    .reverse();
  const initialYear = years[0] || String(new Date().getFullYear());
  const [view, setView] = useState({
    search: "",
    date: "",
    month: "",
    year: "",
    group: "month",
    sort: "newest",
  });
  const selectedYear = view.year || initialYear;
  const [filtersOpen, setFiltersOpen] = useState(true);
  const entries = allEntries
    .filter((entry) => {
      const [year, month] = entry.watched_at.split("-");
      return (
        year === selectedYear &&
        (!view.search ||
          entry.movie.title
            .toLowerCase()
            .includes(view.search.toLowerCase())) &&
        (!view.date || entry.watched_at === view.date) &&
        (!view.month || month === view.month)
      );
    })
    .sort(
      (a, b) =>
        a.watched_at.localeCompare(b.watched_at) *
        (view.sort === "oldest" ? 1 : -1),
    );
  const update = (name, value) =>
    setView((current) => ({ ...current, [name]: value }));
  const clear = () =>
    setView({
      search: "",
      date: "",
      month: "",
      year: selectedYear,
      group: "month",
      sort: "newest",
    });

  return (
    <>
      <PageHero
        eyebrow="Every screening, in order"
        title="Watch"
        accent="history."
        description="A timeline of films and series, organized by the moments you watched them."
        count={loading ? "—" : entries.length}
        countLabel="viewing entries"
      />
      <section className="page-content page-shell">
        <div className="collection-tools">
          <label className="archive-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search history</span>
            <input
              type="search"
              autoComplete="off"
              placeholder="Search watch history"
              value={view.search}
              onChange={(e) => update("search", e.target.value.trimStart())}
            />
          </label>
          <div className="history-view-controls">
            <label className="history-view-control">
              <span>Year</span>
              <select
                aria-label="History year"
                value={selectedYear}
                onChange={(e) => update("year", e.target.value)}
              >
                {years.length ? (
                  years.map((year) => <option key={year}>{year}</option>)
                ) : (
                  <option>{initialYear}</option>
                )}
              </select>
            </label>
            <label className="history-view-control">
              <span>Group by</span>
              <select
                aria-label="Group history by"
                value={view.group}
                onChange={(e) => update("group", e.target.value)}
              >
                <option value="month">Month</option>
                <option value="none">No grouping</option>
              </select>
            </label>
            <label className="history-view-control">
              <span>Sort</span>
              <select
                aria-label="Sort history"
                value={view.sort}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
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
        </div>
        <div
          className={`history-filters history-page-filters ${filtersOpen ? "is-open" : ""}`}
        >
          <label>
            <span>Specific date</span>
            <input
              type="date"
              value={view.date}
              onChange={(e) => update("date", e.target.value)}
            />
          </label>
          <label>
            <span>Month</span>
            <select
              value={view.month}
              onChange={(e) => update("month", e.target.value)}
            >
              <MonthOptions />
            </select>
          </label>
          <button className="text-button" type="button" onClick={clear}>
            Clear filters
          </button>
        </div>
        {loading ? (
          <LoadingState>Loading watch history…</LoadingState>
        ) : error ? (
          <ErrorState>The watch history could not be loaded.</ErrorState>
        ) : (
          <div className="history-groups">
            <HistoryGroups entries={entries} grouped={view.group === "month"} />
          </div>
        )}
      </section>
    </>
  );
}
