import { Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui/States";
import { CategoryFormModal } from "../features/categories/components/CategoryFormModal";
import { CategoryLibraryManager } from "../features/categories/components/CategoryLibraryManager";
import { CategorySyncStatus } from "../features/categories/components/CategorySyncStatus";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { categoryDisplayName } from "../features/categories/utils/category.util";

export default function CategorySettingsPage() {
  const { categorySlug } = useParams();
  const data = useCategories();
  const [editOpen, setEditOpen] = useState(false);
  const category = data.categories.find((item) => item.slug === categorySlug);
  if (data.loading && !category) return <main className="page-shell wm-page"><LoadingState>Loading category library…</LoadingState></main>;
  if (!category) return <main className="page-shell wm-page"><ErrorState>This category could not be found.</ErrorState></main>;
  const titles = data.titles.filter((title) => title.categoryId === category.id);
  const displayName = categoryDisplayName(category.name);
  return <main className="page-shell wm-settings-page"><div className="wm-settings-heading"><h1>{displayName}</h1><p>Manage this category's titles, watched state, and prerequisites. Player settings are global under Watch Anything.</p><div className="category-settings-actions"><Link to={`/categories/${category.slug}`}>Back to dashboard</Link><button className="secondary-button" type="button" onClick={() => setEditOpen(true)}><Pencil aria-hidden="true" /> Edit category</button></div><CategorySyncStatus /></div><div className="wm-settings-layout"><nav className="wm-settings-nav" aria-label="Category settings sections"><a href="#library">Library</a><Link to="/watch-anything">Global player settings</Link></nav><div className="wm-settings-content"><CategoryLibraryManager category={category} titles={titles} /></div></div>{editOpen && <CategoryFormModal existing={category} onClose={() => setEditOpen(false)} />}</main>;
}
