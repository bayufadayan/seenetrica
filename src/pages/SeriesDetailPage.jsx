import { ArrowLeft, ArrowRight, ArrowUpDown, Check, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { Poster } from "../components/ui/Poster";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useArchive } from "../context/ArchiveContext";
import { useToast } from "../context/ToastContext";
import { CategoryFormModal } from "../features/categories/components/CategoryFormModal";
import { CategoryIcon } from "../features/categories/components/CategoryIcon";
import { CategoryTitlePickerModal } from "../features/categories/components/CategoryTitlePickerModal";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { today } from "../utils/formatters";
import "../features/categories/styles/series.css";

export default function SeriesDetailPage() {
  const { categorySlug } = useParams();
  const categories = useCategories();
  const { movies, history, loading: archiveLoading, error: archiveError } = useArchive();
  const toast = useToast();
  const navigate = useNavigate();
  const series = categories.categories.find((item) => item.slug === categorySlug && item.kind === "series");
  useDocumentTitle(series?.name || "Series");
  const [editing, setEditing] = useState(false);
  const [editDetails, setEditDetails] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTitleId, setSelectedTitleId] = useState(null);
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const titles = useMemo(() => categories.titles
    .filter((title) => title.categoryId === series?.id && !title.deletedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)), [categories.titles, series?.id]);
  const movieById = useMemo(() => new Map(movies.map((movie) => [String(movie.id), movie])), [movies]);
  const watchedMovieIds = useMemo(() => new Set(history.map((entry) => String(entry.movie_id))), [history]);
  const selectedTitle = titles.find((title) => title.id === selectedTitleId) || null;

  async function addMovie(payload) {
    if (!series) return;
    try {
      const records = Array.isArray(payload) ? payload : [payload];
      if (records.length > 1) await categories.createTitles(series.id, records);
      else await categories.createTitle(series.id, records[0]);
      toast(`${records.length} ${records.length === 1 ? "title" : "titles"} added to ${series.name}.`);
    } catch (error) {
      toast(error.message, "error");
      throw error;
    }
  }

  async function removeMovie(title) {
    try {
      await categories.deleteTitle(title.id);
      toast(`${title.title} removed from this series.`);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function saveSeriesNote(title) {
    try {
      await categories.updateTitle(title.id, { note: noteDraft });
      setEditingNoteId(null);
      toast("Note saved.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function deleteSeries() {
    try {
      await categories.deleteCategory(series.id);
      toast(`${series.name} was deleted. Its films remain in All Movies and History.`);
      navigate("/series");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function moveTitle(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const next = [...titles];
    const from = next.findIndex((item) => item.id === sourceId);
    const to = next.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    try {
      for (const [index, title] of next.entries()) {
        if (title.sortOrder !== index) await categories.updateTitle(title.id, { sortOrder: index });
      }
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function moveBy(title, delta) {
    const index = titles.findIndex((item) => item.id === title.id);
    const target = titles[index + delta];
    if (target) await moveTitle(title.id, target.id);
  }

  async function markWatched(title, watchedAt, theater) {
    try {
      await categories.recordCompletedViewing({
        sessionId: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        categoryTitleId: title.id,
        watchedAt,
        watchedInTheater: theater,
      });
      setSelectedTitleId(null);
      toast("Viewing saved locally and queued for sync.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  if ((categories.loading || archiveLoading) && !series) return <main className="page-shell series-page"><LoadingState>Opening series…</LoadingState></main>;
  if (!series) return <main className="page-shell series-page"><ErrorState>This series could not be found.</ErrorState><Link className="secondary-button" to="/series">Back to series</Link></main>;

  return (
    <>
      <section className="page-shell series-detail-heading">
        <div className="series-detail-icon"><CategoryIcon category={series} /></div>
        <div className="series-detail-copy"><p className="eyebrow">Watch order · {titles.length} titles</p><h1>{series.name}<span>.</span></h1><p className="page-hero-description">Films in your chosen order. Select a film to open its note.</p></div>
        <div className="series-detail-actions">
          <label className="series-order-switch"><span>{editing ? "Reorder on" : "Reorder"}</span><input type="checkbox" role="switch" checked={editing} onChange={(event) => setEditing(event.target.checked)} /><span className="series-switch-track" aria-hidden="true" /></label>
          <button className="secondary-button" type="button" onClick={() => setEditDetails(true)}><Pencil aria-hidden="true" /> Name & image</button>
          <button className="series-delete-trigger" type="button" onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden="true" /> Delete series</button>
        </div>
      </section>
      <section className="page-shell page-content series-detail-page">
        <div className="series-order-heading"><span>{editing ? "Drag films to change their order" : "Your timeline · first to last"}</span><button className="secondary-button" type="button" onClick={() => setPickerOpen(true)}><Plus aria-hidden="true" /> Add Movie</button></div>
        {archiveError && <p className="series-offline-note" role="status">Showing saved series. Movie details may be unavailable until the archive reconnects.</p>}
        {titles.length ? (
          <div className="series-timeline-scroll" role="region" aria-label="Series watch order">
          <ol className={`series-timeline-track ${editing ? "is-editing" : ""}`}>
            {titles.map((title, index) => {
              const movie = movieById.get(String(title.movieId));
              const watched = title.isWatched || watchedMovieIds.has(String(title.movieId)) || movie?.status === "watched";
              return (
                <li className={`series-timeline-item ${draggedId === title.id ? "is-dragged" : ""}`} key={title.id} draggable={editing} onDragStart={() => setDraggedId(title.id)} onDragOver={(event) => { if (editing) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); moveTitle(draggedId, title.id); setDraggedId(null); }} onDragEnd={() => setDraggedId(null)}>
                  <span className="series-timeline-node" aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span></span>
                  <Link className="series-timeline-film" to={`/movies/${encodeURIComponent(movie?.id || title.movieId)}`} aria-label={`Open details for ${movie?.title || title.title}`}>
                    <Poster className="series-timeline-poster" src={movie?.poster_url || title.posterPath} alt={`${movie?.title || title.title} poster`} loading="lazy" />
                    <span className="series-timeline-film-copy"><strong>{movie?.title || title.title}</strong><small>{(movie?.release_date || title.releaseDate)?.slice(0, 4) || "Year unknown"} · {movie?.media_type === "series" || title.type === "series" ? "Series" : "Movie"}</small></span>
                  </Link>
                  <button className="series-note-toggle" type="button" aria-expanded={expandedNoteId === title.id} onClick={() => { setExpandedNoteId((current) => current === title.id ? null : title.id); setEditingNoteId(null); setNoteDraft(title.note || ""); }}><span>{expandedNoteId === title.id ? "Hide notes" : "View notes"}</span><span aria-hidden="true">{expandedNoteId === title.id ? "−" : "+"}</span></button>
                  {expandedNoteId === title.id && <div className="series-note-bubble"><span className="series-note-bubble-tail" aria-hidden="true" />{editingNoteId === title.id ? <label className="series-note-inline-editor"><span>Film note</span><textarea value={noteDraft} rows={4} maxLength={5000} autoFocus onChange={(event) => setNoteDraft(event.target.value)} placeholder="Write a note for this film…" /></label> : <p className={title.note ? "" : "series-note-empty"}>{title.note || "No note yet. Add a note for this film."}</p>}<div className="series-note-bubble-actions">{editingNoteId === title.id ? <><button type="button" onClick={() => saveSeriesNote(title)}><Save aria-hidden="true" /> Save</button><button type="button" onClick={() => { setEditingNoteId(null); setNoteDraft(title.note || ""); }}>Cancel</button></> : <button type="button" onClick={() => { setEditingNoteId(title.id); setNoteDraft(title.note || ""); }}><Pencil aria-hidden="true" /> {title.note ? "Edit note" : "Add note"}</button>}<button type="button" onClick={() => setSelectedTitleId(title.id)}>{watched ? "Log another viewing" : "Log viewing"}</button></div></div>}
                  <span className={`series-watched-status ${watched ? "is-watched" : ""}`}>{watched ? <><Check aria-hidden="true" /> Watched</> : "Not watched"}</span>
                  {editing && <div className="series-item-actions"><span className="series-drag-handle" aria-hidden="true"><ArrowUpDown /></span><button type="button" aria-label={`Move ${title.title} left`} disabled={index === 0} onClick={() => moveBy(title, -1)}><ArrowLeft aria-hidden="true" /></button><button type="button" aria-label={`Move ${title.title} right`} disabled={index === titles.length - 1} onClick={() => moveBy(title, 1)}><ArrowRight aria-hidden="true" /></button><button type="button" aria-label={`Remove ${title.title} from this series`} onClick={() => removeMovie(title)}><Trash2 aria-hidden="true" /></button></div>}
                </li>
              );
            })}
          </ol>
          </div>
        ) : <EmptyState>This series is empty. Turn on Reorder to add films from All Movies.</EmptyState>}
        <Link className="series-back-link" to="/series">Back to all series</Link>
      </section>
      {editDetails && <CategoryFormModal existing={series} onClose={() => setEditDetails(false)} />}
      {deleteOpen && <Modal title="Delete this series?" onClose={() => setDeleteOpen(false)} className="series-delete-modal"><p><strong>{series.name}</strong> and its order and notes will be removed. The film records, categories, and watch history will stay in your library.</p><div className="form-actions"><button className="danger-button" type="button" onClick={deleteSeries}><Trash2 aria-hidden="true" /> Delete series</button><button className="secondary-button" type="button" onClick={() => setDeleteOpen(false)}>Cancel</button></div></Modal>}
      {pickerOpen && <CategoryTitlePickerModal titles={titles} categoryName={series.name} sortOrder={titles.length} onSave={addMovie} onClose={() => setPickerOpen(false)} />}
      {selectedTitle && <SeriesViewingModal title={selectedTitle} movie={movieById.get(String(selectedTitle.movieId))} watched={selectedTitle.isWatched || watchedMovieIds.has(String(selectedTitle.movieId)) || movieById.get(String(selectedTitle.movieId))?.status === "watched"} onMarkWatched={markWatched} onClose={() => setSelectedTitleId(null)} />}
    </>
  );
}

function SeriesViewingModal({ title, movie, watched, onMarkWatched, onClose }) {
  const [watchedAt, setWatchedAt] = useState(today());
  const [theater, setTheater] = useState(false);
  const [busy, setBusy] = useState(false);
  const displayTitle = movie?.title || title.title;

  async function saveViewing() {
    setBusy(true);
    try { await onMarkWatched(title, watchedAt, theater); }
    finally { setBusy(false); }
  }

  return <Modal title={`${displayTitle} · Viewing`} onClose={onClose} busy={busy} className="series-note-modal"><div className="series-note-meta">{movie?.release_date?.slice(0, 4) || title.releaseDate?.slice(0, 4) || "Year unknown"} · {movie?.media_type === "series" || title.type === "series" ? "Series" : "Movie"}</div><div className="series-note-viewing"><h3>Viewing history</h3>{watched && <p className="series-already-watched"><Check aria-hidden="true" /> This film is already marked watched.</p>}<label className="form-field"><span>Watched on</span><input type="date" required value={watchedAt} onChange={(event) => setWatchedAt(event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={theater} onChange={(event) => setTheater(event.target.checked)} />Watched in a theater</label><button className="primary-button" type="button" disabled={busy || !watchedAt} onClick={saveViewing}>{busy ? "Saving…" : watched ? "Log another viewing" : "Mark watched"}</button><p className="series-note-hint">This viewing will be added to your History.</p></div></Modal>;
}
