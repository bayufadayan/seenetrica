import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "../components/common/PageHero";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useArchive } from "../context/ArchiveContext";
import { CategoryFormModal } from "../features/categories/components/CategoryFormModal";
import { CategoryIcon } from "../features/categories/components/CategoryIcon";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "../features/categories/styles/series.css";

export default function SeriesPage() {
  useDocumentTitle("Series");
  const { categories, titles, loading: categoriesLoading } = useCategories();
  const { history, loading: archiveLoading, error } = useArchive();
  const [createOpen, setCreateOpen] = useState(false);
  const series = categories.filter((item) => item.kind === "series");
  const titlesBySeries = useMemo(() => {
    const grouped = new Map();
    titles.forEach((title) => {
      if (!grouped.has(title.categoryId)) grouped.set(title.categoryId, []);
      grouped.get(title.categoryId).push(title);
    });
    return grouped;
  }, [titles]);
  const movieIdsWatched = useMemo(() => new Set(history.map((entry) => String(entry.movie_id))), [history]);

  return (
    <>
      <PageHero
        eyebrow="Watch in order"
        title="Your stories,"
        accent="in sequence."
        description="Build a watch order from films already in your library. Each title can belong to both a category and any series."
        count={categoriesLoading ? "—" : series.length}
        countLabel="series"
      />
      <section className="page-shell page-content series-page">
        <div className="series-page-heading">
          <p className="collection-status">Your series</p>
          <button className="primary-button" type="button" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" /> Create series
          </button>
        </div>
        {categoriesLoading ? <LoadingState>Loading series…</LoadingState> : error && archiveLoading ? <ErrorState>The series could not be loaded.</ErrorState> : series.length ? (
          <div className="series-card-grid">
            {series.map((item) => {
              const items = [...(titlesBySeries.get(item.id) || [])].sort((left, right) => left.sortOrder - right.sortOrder);
              const watchedCount = items.filter((title) => title.isWatched || movieIdsWatched.has(String(title.movieId))).length;
              return (
                <Link className="series-card" key={item.id} to={`/series/${encodeURIComponent(item.slug)}`}>
                  <span className="series-card-art"><CategoryIcon category={item} /></span>
                  <span className="series-card-copy">
                    <strong>{item.name}</strong>
                    <span>{items.length} {items.length === 1 ? "title" : "titles"} · {watchedCount} watched</span>
                  </span>
                  <span className="series-card-open" aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState>No series yet. Create one, then add films from All Movies.</EmptyState>
        )}
        {createOpen && <CategoryFormModal kind="series" onClose={() => setCreateOpen(false)} />}
      </section>
    </>
  );
}
