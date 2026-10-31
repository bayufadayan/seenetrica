import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../context/ToastContext";
import { CategoryFormModal } from "../features/categories/components/CategoryFormModal";
import { CategoryLibraryManager } from "../features/categories/components/CategoryLibraryManager";
import { CategorySyncStatus } from "../features/categories/components/CategorySyncStatus";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { categoryDisplayName } from "../features/categories/utils/category.util";

export default function CategorySettingsPage() {
  const { categorySlug } = useParams();
  const data = useCategories();
  const navigate = useNavigate();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const category = data.categories.find((item) => item.slug === categorySlug && (item.kind || "category") === "category");
  if (data.loading && !category) return <main className="page-shell wm-page"><LoadingState>Loading category library…</LoadingState></main>;
  if (!category) return <main className="page-shell wm-page"><ErrorState>This category could not be found.</ErrorState></main>;
  const titles = data.titles.filter((title) => title.categoryId === category.id);
  const displayName = categoryDisplayName(category.name);

  async function removeCategory() {
    setDeleteBusy(true);
    try {
      await data.deleteCategory(category.id);
      toast(`${displayName} and its titles were deleted. Movie records and watch history remain in your library.`);
      navigate("/categories");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  return <main className="page-shell wm-settings-page"><div className="wm-settings-heading"><h1>{displayName}</h1><p>Manage this category's titles, watched state, and prerequisites. Player settings are global under Watch Anything.</p><div className="category-settings-actions"><Link to={`/categories/${category.slug}`}>Back to dashboard</Link><button className="secondary-button" type="button" onClick={() => setEditOpen(true)}><Pencil aria-hidden="true" /> Edit category</button><button className="secondary-button category-delete-button" type="button" onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden="true" /> Delete category</button></div><CategorySyncStatus /></div><div className="wm-settings-layout"><nav className="wm-settings-nav" aria-label="Category settings sections"><a href="#library">Library</a><Link to="/watch-anything">Global player settings</Link></nav><div className="wm-settings-content"><CategoryLibraryManager category={category} titles={titles} /></div></div>{editOpen && <CategoryFormModal existing={category} onClose={() => setEditOpen(false)} />}{deleteOpen && <Modal title="Delete category and its contents?" onClose={() => setDeleteOpen(false)} busy={deleteBusy} className="category-delete-modal"><p><strong>{displayName}</strong> and its category titles, notes, and order will be removed. Movie records, other categories/series, and watch history will remain in your library.</p><div className="form-actions"><button className="danger-button" type="button" disabled={deleteBusy} onClick={removeCategory}><Trash2 aria-hidden="true" />{deleteBusy ? "Deleting…" : "Delete category"}</button><button className="secondary-button" type="button" disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>Cancel</button></div></Modal>}</main>;
}
