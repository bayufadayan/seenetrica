import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Folder, FolderPlus, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { useToast } from "../context/ToastContext";
import { archiveService } from "../services/archive.service";
import { Modal } from "../components/ui/Modal";
import { Poster } from "../components/ui/Poster";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { CategoryTitlePickerModal } from "../features/categories/components/CategoryTitlePickerModal";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { normalizeTimelines, defaultTimelineId } from "../features/categories/utils/timeline.util";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./FavoritesPage.css";

const inFolder = (item, folderId) => item.kind === "movie" && String(item.parent_id || "") === folderId;
const ordered = (items) => [...items].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));

export default function MovieFavoritesPage() {
  const { franchiseId = "" } = useParams();
  const { movies, favorites = [], loading, error, refresh, applyFavorites } = useArchive();
  const toast = useToast();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragged, setDragged] = useState(null);
  const saving = useRef(false);
  const movieMap = new Map(movies.map((movie) => [String(movie.id), movie]));
  const folder = franchiseId ? favorites.find((item) => String(item.id) === franchiseId && item.entry_type === "franchise" && !item.parent_id) : null;
  const items = ordered(favorites.filter((item) => inFolder(item, franchiseId)));
  const title = folder ? String(folder.name) : "Favorite Movies";
  useDocumentTitle(title);

  async function save(data) {
    if (saving.current) throw new Error("Please wait for the current change to finish.");
    const pin = archiveService.askForPin();
    if (!pin) throw new Error(pin === null ? "Save cancelled." : "PIN is required.");
    saving.current = true;
    setBusy(true);
    try {
      const result = await archiveService.writeAction("updateFavorites", { kind: "movie", parent_id: franchiseId, ...data }, pin);
      if (Array.isArray(result?.favorites)) applyFavorites(result.favorites);
      await refresh();
      toast("Favorites saved.");
    } finally { saving.current = false; setBusy(false); }
  }

  async function move(fromId, toId) {
    if (busy || !fromId || fromId === toId) return;
    const ids = items.map((item) => String(item.id));
    const from = ids.indexOf(String(fromId)), to = ids.indexOf(String(toId));
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    try { await save({ operation: "reorder", ids }); }
    catch (nextError) { toast(nextError.message, "error"); }
  }

  async function remove(item) {
    if (item.entry_type === "franchise") { setDialog({ type: "delete", item }); return; }
    try { await save({ operation: "remove", id: item.id }); }
    catch (nextError) { toast(nextError.message, "error"); }
  }

  if (loading) return <main className="favorites-page page-shell"><LoadingState>Loading favorites…</LoadingState></main>;
  if (error) return <main className="favorites-page page-shell"><ErrorState>Favorites could not be loaded.</ErrorState></main>;
  if (franchiseId && !folder) return <main className="favorites-page page-shell"><EmptyState>This franchise is no longer in your favorites.</EmptyState><Link to="/favorites/movies">Back to Favorite Movies</Link></main>;

  return <main className="favorites-page page-shell">
    {folder && <Link className="favorites-back" to="/favorites/movies"><ArrowLeft aria-hidden="true" /> Favorite Movies</Link>}
    <header className="favorites-heading">
      <div><p className="eyebrow">{folder ? "FRANCHISE" : "YOUR PERSONAL PICKS"}</p><h1>{folder ? title : <>Favorite <em>movies.</em></>}</h1><p className="favorites-caption">{items.length} {folder ? "titles" : "favorites"} · Your order, your favorites.</p></div>
      <div className="favorites-actions">
        {folder ? <><button className="text-button" type="button" disabled={busy} onClick={() => setDialog({ type: "rename", item: folder })}><Pencil aria-hidden="true" /> Rename</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setDialog({ type: "copy" })}><Copy aria-hidden="true" /> Copy timeline</button></> : <button className="secondary-button" type="button" disabled={busy} onClick={() => setDialog({ type: "create" })}><FolderPlus aria-hidden="true" /> Add franchise</button>}
        <button className="primary-button" type="button" disabled={busy} onClick={() => setDialog({ type: "movie" })}><Plus aria-hidden="true" /> Add movie / series</button>
      </div>
    </header>
    {items.length ? <>
      <p className="favorites-order-hint">Drag to reorder, or use the arrows.</p>
      <ol className="favorites-list" aria-label={title} aria-busy={busy}>
        {items.map((item, index) => {
          const isFolder = item.entry_type === "franchise";
          const children = isFolder ? ordered(favorites.filter((child) => inFolder(child, String(item.id)))) : [];
          const movie = isFolder ? null : movieMap.get(String(item.item_id));
          const coverMovie = isFolder ? movieMap.get(String(children[0]?.item_id)) : null;
          const name = String(movie?.title ?? item.name ?? "Untitled");
          const image = movie?.poster_url || item.image_url || coverMovie?.poster_url || children[0]?.image_url;
          const href = isFolder ? `/favorites/franchises/${encodeURIComponent(item.id)}` : `/movies/${encodeURIComponent(item.item_id)}`;
          return <li key={item.id} className={`favorite-row ${isFolder ? "is-franchise" : ""} ${dragged === item.id ? "is-dragged" : ""}`} draggable={!busy} onDragStart={(event) => { setDragged(item.id); event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { if (!busy) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); move(dragged, item.id); setDragged(null); }} onDragEnd={() => setDragged(null)}>
            <span className="favorite-rank">{String(index + 1).padStart(2, "0")}</span>
            <Link className={`favorite-image ${isFolder ? "is-folder" : ""}`} to={href} tabIndex={-1} aria-hidden="true">{image ? <Poster key={image} src={image} alt="" loading="lazy" /> : <Folder aria-hidden="true" />}{isFolder && image && <span className="favorite-folder-badge"><Folder aria-hidden="true" /></span>}</Link>
            <div className="favorite-copy"><Link to={href}>{name}</Link><span>{isFolder ? `Franchise · ${children.length} titles` : `${String(movie?.release_date || "").slice(0, 4) || "Year unknown"} · ${movie?.media_type || "Movie"}`}</span></div>
            <div className="favorite-controls">
              <button type="button" disabled={busy || index === 0} onClick={() => move(item.id, items[index - 1].id)} aria-label={`Move ${name} up`}><ArrowUp aria-hidden="true" /></button>
              <button type="button" disabled={busy || index === items.length - 1} onClick={() => move(item.id, items[index + 1].id)} aria-label={`Move ${name} down`}><ArrowDown aria-hidden="true" /></button>
              <button type="button" disabled={busy} onClick={() => remove(item)} aria-label={`Remove ${name} from favorites`}><Trash2 aria-hidden="true" /></button><GripVertical className="favorite-grip" aria-hidden="true" />
            </div>
          </li>;
        })}
      </ol>
    </> : <div className="favorites-empty"><Folder aria-hidden="true" /><EmptyState>{folder ? "This franchise is ready for your films and series." : "Add a film, series, or your first franchise."}</EmptyState></div>}
    {dialog?.type === "movie" && <CategoryTitlePickerModal categoryName={folder ? title : "Favorite Movies"} titles={items.filter((item) => item.entry_type !== "franchise").map((item) => ({ movieId: item.item_id }))} onClose={() => setDialog(null)} onSave={(payload) => save({ operation: "add_movies", movie_ids: (Array.isArray(payload) ? payload : [payload]).map((record) => String(record.movieId)) })} />}
    {["create", "rename"].includes(dialog?.type) && <FranchiseNameModal existing={dialog.item} busy={busy} onClose={() => setDialog(null)} onSave={async (name) => { await save({ operation: dialog.type === "create" ? "create_franchise" : "rename_franchise", parent_id: "", id: dialog.item?.id, name }); setDialog(null); }} />}
    {dialog?.type === "copy" && <TimelineCopyModal movies={movies} existingIds={new Set(items.map((item) => String(item.item_id)))} busy={busy} onClose={() => setDialog(null)} onCopy={async (ids) => { await save({ operation: "add_movies", movie_ids: ids }); setDialog(null); }} />}
    {dialog?.type === "delete" && <DeleteFranchiseModal item={dialog.item} busy={busy} onClose={() => setDialog(null)} onDelete={async () => { await save({ operation: "remove", id: dialog.item.id }); setDialog(null); }} />}
  </main>;
}

function FranchiseNameModal({ existing, busy, onSave, onClose }) {
  const [name, setName] = useState(String(existing?.name || ""));
  const [error, setError] = useState("");
  return <Modal title={existing ? "Rename franchise" : "New franchise"} busy={busy} onClose={onClose}>
    <form className="form-grid" onSubmit={async (event) => { event.preventDefault(); setError(""); try { await onSave(name.trim()); } catch (nextError) { setError(nextError.message); } }}>
      <label className="form-field is-full"><span>Franchise name</span><input autoFocus required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="The Hunger Games" /></label>
      {error && <p className="wm-field-error is-full" role="alert">{error}</p>}
      <div className="form-actions is-full"><button className="primary-button" type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : existing ? "Save name" : "Create franchise"}</button><button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </form>
  </Modal>;
}

function TimelineCopyModal({ movies, existingIds, busy, onCopy, onClose }) {
  const categories = useCategories();
  const series = categories.categories.filter((item) => item.kind === "series" && !item.deletedAt);
  const [seriesChoice, setSeriesChoice] = useState("");
  const [timelineChoice, setTimelineChoice] = useState("");
  const [error, setError] = useState("");
  const selectedSeries = series.find((item) => item.id === seriesChoice) || series[0];
  const timelines = normalizeTimelines(selectedSeries?.id, selectedSeries?.timelines, "series");
  const selectedTimeline = timelines.find((item) => item.id === timelineChoice) || timelines[0];
  const titles = categories.titles.filter((item) => !item.deletedAt && item.categoryId === selectedSeries?.id && (item.timelineId || defaultTimelineId(selectedSeries?.id)) === selectedTimeline?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.title).localeCompare(String(b.title)));
  const movieIds = new Set(movies.map((movie) => String(movie.id)));
  const missing = titles.some((item) => !movieIds.has(String(item.movieId)));
  const newIds = [...new Set(titles.map((item) => String(item.movieId)))].filter((id) => !existingIds.has(id));
  return <Modal title="Copy a Series timeline" busy={busy} onClose={onClose}>
    {categories.loading ? <LoadingState>Loading timelines…</LoadingState> : !series.length ? <EmptyState>No Series timelines yet.</EmptyState> : <>
      <div className="form-grid"><label className="form-field"><span>Series</span><select value={selectedSeries.id} disabled={busy} onChange={(event) => { setSeriesChoice(event.target.value); setTimelineChoice(""); }}>{series.map((item) => <option key={item.id} value={item.id}>{String(item.name)}</option>)}</select></label><label className="form-field"><span>Timeline</span><select value={selectedTimeline?.id || ""} disabled={busy} onChange={(event) => setTimelineChoice(event.target.value)}>{timelines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <ol className="favorites-copy-preview">{titles.map((item) => <li key={item.id}>{String(item.title)}{existingIds.has(String(item.movieId)) && <small>Already added</small>}</li>)}</ol>
      {!titles.length && <EmptyState>This timeline is empty.</EmptyState>}
      <p className="favorites-caption">Adds {newIds.length} titles in timeline order. Your copy can be reordered independently.</p>
      {missing && <p className="wm-field-error" role="alert">Some titles are not in All Movies yet. Sync the Series library before copying.</p>}
      {error && <p className="wm-field-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="primary-button" type="button" disabled={busy || missing || !newIds.length} onClick={async () => { setError(""); try { await onCopy(newIds); } catch (nextError) { setError(nextError.message); } }}>{busy ? "Copying…" : "Copy into franchise"}</button><button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </>}
  </Modal>;
}

function DeleteFranchiseModal({ item, busy, onDelete, onClose }) {
  const [error, setError] = useState("");
  return <Modal title="Remove this franchise?" busy={busy} onClose={onClose}><p><strong>{String(item.name)}</strong> and its favorite entries will be removed. Films and Series timelines stay in your library.</p>{error && <p role="alert" className="wm-field-error">{error}</p>}<div className="form-actions"><button type="button" className="danger-button" disabled={busy} onClick={async () => { try { await onDelete(); } catch (nextError) { setError(nextError.message); } }}>Remove franchise</button><button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div></Modal>;
}
