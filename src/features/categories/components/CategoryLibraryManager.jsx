import { Layers3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Poster } from "../../../components/ui/Poster";
import { useToast } from "../../../context/ToastContext";
import { useCategories } from "../context/CategoriesProvider";
import { categoryDisplayName } from "../utils/category.util";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";
import { CategoryBulkAddModal } from "./CategoryBulkAddModal";
import { CategoryTitleForm } from "./CategoryTitleForm";

function titleMeta(title) {
  return [title.type === "movie" ? "Movie" : "Series", title.seasonNumber ? `Season ${title.seasonNumber}` : null, title.releaseDate?.slice(0, 4) || "TBA", title.runtimeMinutes ? `${title.runtimeMinutes} min` : "Runtime unknown"].filter(Boolean).join(" · ");
}

export function CategoryLibraryManager({ category, titles }) {
  const data = useCategories();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [watched, setWatched] = useState("all");
  const [editing, setEditing] = useState(undefined);
  const [bulkOpen, setBulkOpen] = useState(false);
  const categoryName = categoryDisplayName(category.name);
  const filtered = titles.filter((title) => `${title.title} ${title.baseTitle || ""}`.toLowerCase().includes(query.trim().toLowerCase()) && (type === "all" || title.type === type) && (watched === "all" || title.isWatched === (watched === "watched")));

  async function save(payload) {
    if (Array.isArray(payload)) await data.createTitles(category.id, payload);
    else if (editing) await data.updateTitle(editing.id, payload);
    else await data.createTitle(category.id, payload);
    setEditing(undefined);
    toast(Array.isArray(payload) ? `${payload.length} titles saved locally.` : `${categoryName} updated locally.`);
  }

  async function remove(title) {
    const dependents = titles.filter((item) => item.prerequisiteIds?.includes(title.id));
    const warning = dependents.length ? ` It is used by ${dependents.length} prerequisite relation(s), which will also be removed.` : "";
    if (!window.confirm(`Remove ${title.title} from ${categoryName}?${warning}`)) return;
    try { await data.deleteTitle(title.id); toast("Title removed locally."); } catch (error) { toast(error.message, "error"); }
  }

  return (
    <section className="wm-settings-section" id="library">
      <header><h2>{categoryName} Library</h2><div className="wm-library-header-actions"><button className="primary-button" type="button" onClick={() => setEditing(null)}><Plus aria-hidden="true" /> Add Title</button><button className="secondary-button" type="button" onClick={() => setBulkOpen(true)}><Layers3 aria-hidden="true" /> Bulk Add</button></div></header>
      <div className="wm-library-tools category-library-tools">
        <label className="archive-search"><Search aria-hidden="true" /><input type="search" aria-label={`Search ${categoryName} library`} placeholder="Search category library" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="form-field"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option><option value="movie">Movies</option><option value="series">Series</option></select></label>
        <label className="form-field"><span>Status</span><select value={watched} onChange={(event) => setWatched(event.target.value)}><option value="all">All status</option><option value="unwatched">Unwatched</option><option value="watched">Watched</option></select></label>
      </div>
      <div className="wm-library-grid">
        {filtered.map((title) => <article className="wm-library-card" key={title.id}><Poster src={getTmdbImageUrl(title.posterPath, "w342")} alt="" /><div><h3>{title.title}</h3><p>{titleMeta(title)}</p><p className="wm-prerequisite-count">{title.prerequisiteIds?.length || 0} prerequisites</p><label className="checkbox-field"><input type="checkbox" checked={title.isWatched} onChange={async (event) => { try { await data.setTitleWatched(title.id, event.target.checked); } catch (error) { toast(error.message, "error"); } }} /> Watched</label></div><div className="wm-card-actions"><button type="button" aria-label={`Edit ${title.title}`} onClick={() => setEditing(title)}><Pencil aria-hidden="true" /></button><button type="button" aria-label={`Delete ${title.title}`} onClick={() => remove(title)}><Trash2 aria-hidden="true" /></button></div></article>)}
        {!filtered.length && <p className="wm-empty-row">No titles match these filters.</p>}
      </div>
      {editing !== undefined && <CategoryTitleForm existing={editing} titles={titles} categoryName={categoryName} onSave={save} onClose={() => setEditing(undefined)} />}
      {bulkOpen && <CategoryBulkAddModal titles={titles} categoryName={categoryName} onSave={save} onClose={() => setBulkOpen(false)} />}
    </section>
  );
}
