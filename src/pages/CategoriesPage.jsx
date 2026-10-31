import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "../components/common/PageHero";
import { EmptyState, LoadingState } from "../components/ui/States";
import { CategoryFormModal } from "../features/categories/components/CategoryFormModal";
import { CategoryIcon } from "../features/categories/components/CategoryIcon";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { categoryDisplayName } from "../features/categories/utils/category.util";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "../features/categories/styles/series.css";

export default function CategoriesPage() {
  useDocumentTitle("Categories");
  const { categories, titles, loading } = useCategories();
  const [createOpen, setCreateOpen] = useState(false);
  const items = categories.filter((item) => (item.kind || "category") === "category");

  return (
    <>
      <PageHero
        eyebrow="Your collections"
        title="Every kind of"
        accent="story."
        description="Group films by genre, theme, or any category you create. A film can also appear in one or more series."
        count={loading ? "—" : items.length}
        countLabel="categories"
      />
      <section className="page-shell page-content series-page">
        <div className="series-page-heading">
          <p className="collection-status">Your categories</p>
          <button className="primary-button" type="button" onClick={() => setCreateOpen(true)}><Plus aria-hidden="true" /> Add category</button>
        </div>
        {loading ? <LoadingState>Loading categories…</LoadingState> : items.length ? (
          <div className="series-card-grid">
            {items.map((category) => {
              const count = titles.filter((title) => title.categoryId === category.id).length;
              return <Link className="series-card" key={category.id} to={`/categories/${encodeURIComponent(category.slug)}`}><span className="series-card-art"><CategoryIcon category={category} /></span><span className="series-card-copy"><strong>{categoryDisplayName(category.name)}</strong><span>{count} {count === 1 ? "title" : "titles"}</span></span><span className="series-card-open" aria-hidden="true">→</span></Link>;
            })}
          </div>
        ) : <EmptyState>No categories yet. Create one to group your films.</EmptyState>}
        {createOpen && <CategoryFormModal kind="category" onClose={() => setCreateOpen(false)} />}
      </section>
    </>
  );
}
