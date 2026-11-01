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
import { createTimeline, normalizeTimelines } from "../features/categories/utils/timeline.util";
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
  const [pickerTimelineId, setPickerTimelineId] = useState(null);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineModalMode, setTimelineModalMode] = useState("create");
  const [timelineModalTimelineId, setTimelineModalTimelineId] = useState(null);
  const [timelineName, setTimelineName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTitleId, setSelectedTitleId] = useState(null);
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const allTitles = useMemo(() => categories.titles
    .filter((title) => title.categoryId === series?.id && !title.deletedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)), [categories.titles, series?.id]);
  const timelines = useMemo(() => normalizeTimelines(series?.id, series?.timelines, "series"), [series?.id, series?.timelines]);
  function titlesForTimeline(timelineId) {
    return allTitles
      .filter((title) => (title.timelineId || `${series?.id}:timeline:default`) === timelineId)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
  }
  const movieById = useMemo(() => new Map(movies.map((movie) => [String(movie.id), movie])), [movies]);
  const watchedMovieIds = useMemo(() => new Set(history.map((entry) => String(entry.movie_id))), [history]);
  const selectedTitle = allTitles.find((title) => title.id === selectedTitleId) || null;

  async function addMovie(payload, timelineId) {
    if (!series) return;
    try {
      const currentTitles = titlesForTimeline(timelineId);
      const records = (Array.isArray(payload) ? payload : [payload]).map((record, index) => ({
        ...record,
        timelineId,
        sortOrder: currentTitles.length + index,
      }));
      if (records.length > 1) await categories.createTitles(series.id, records);
      else await categories.createTitle(series.id, records[0]);
      toast(`${records.length} ${records.length === 1 ? "title" : "titles"} added to ${series.name}.`);
    } catch (error) {
      toast(error.message, "error");
      throw error;
    }
  }

  async function addTimeline(event) {
    event.preventDefault();
    const name = timelineName.trim();
    if (!name) return;
    try {
      const timeline = createTimeline(name, timelines.length);
      const nextTimelines = [...timelines, timeline];
      await categories.updateCategory(series.id, { timelines: nextTimelines });
      setTimelineName("");
      setTimelineModalOpen(false);
      setEditing(false);
      toast(`Timeline “${name}” created.`);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function renameTimeline(event) {
    event.preventDefault();
    const name = timelineName.trim();
    const selectedTimeline = timelines.find((timeline) => timeline.id === timelineModalTimelineId);
    if (!name || !selectedTimeline) return;
    try {
      const nextTimelines = timelines.map((timeline) => timeline.id === selectedTimeline.id
        ? { ...timeline, name, updatedAt: new Date().toISOString() }
        : timeline);
      await categories.updateCategory(series.id, { timelines: nextTimelines });
      setTimelineName("");
      setTimelineModalOpen(false);
      toast(`Timeline renamed to “${name}”.`);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function removeMovie(title) {
    try {
      await categories.deleteTitle(title.id);
      toast(`${title.title} removed from this timeline.`);
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

  async function moveTitle(sourceId, targetId, timelineId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const next = [...titlesForTimeline(timelineId)];
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

  async function moveBy(title, delta, timelineId, timelineTitles) {
    const index = timelineTitles.findIndex((item) => item.id === title.id);
    const target = timelineTitles[index + delta];
    if (target) await moveTitle(title.id, target.id, timelineId);
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
        <div className="series-detail-copy"><p className="eyebrow">Series · {allTitles.length} films</p><h1>{series.name}<span>.</span></h1></div>
        <div className="series-detail-actions">
          <label className="series-order-switch"><span>{editing ? "Reorder on" : "Reorder"}</span><input type="checkbox" role="switch" checked={editing} onChange={(event) => setEditing(event.target.checked)} /><span className="series-switch-track" aria-hidden="true" /></label>
          <button className="secondary-button" type="button" onClick={() => setEditDetails(true)}><Pencil aria-hidden="true" /> Name & image</button>
          <button className="series-delete-trigger" type="button" onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden="true" /> Delete series</button>
        </div>
      </section>
      <section className="page-shell page-content series-detail-page">
        <div className="series-page-toolbar"><span>Timelines</span><button className="series-add-timeline" type="button" onClick={() => { setTimelineModalMode("create"); setTimelineModalTimelineId(null); setTimelineName(""); setTimelineModalOpen(true); }}><Plus aria-hidden="true" /> New timeline</button></div>
        {archiveError && <p className="series-offline-note" role="status">Showing saved series. Movie details may be unavailable until the archive reconnects.</p>}
        <div className="series-timeline-sections">
          {timelines.map((timeline) => {
            const timelineTitles = titlesForTimeline(timeline.id);
            return <section className="series-timeline-section" key={timeline.id} aria-labelledby={`timeline-title-${timeline.id}`}>
              <header className="series-timeline-section-header">
                <h2 id={`timeline-title-${timeline.id}`}>{timeline.name}</h2>
                <div className="series-timeline-actions">
                  <button type="button" onClick={() => { setTimelineModalMode("rename"); setTimelineModalTimelineId(timeline.id); setTimelineName(timeline.name); setTimelineModalOpen(true); }}><Pencil aria-hidden="true" /> Rename</button>
                  <button type="button" onClick={() => { setPickerTimelineId(timeline.id); setPickerOpen(true); }}><Plus aria-hidden="true" /> Add Movie</button>
                </div>
              </header>
              {timelineTitles.length ? <div className="series-timeline-scroll" role="region" aria-label={`${timeline.name} timeline`}>
                <ol className={`series-timeline-track ${editing ? "is-editing" : ""}`}>
                  {timelineTitles.map((title, index) => {
              const movie = movieById.get(String(title.movieId));
              const watched = title.isWatched || watchedMovieIds.has(String(title.movieId)) || movie?.status === "watched";
              const rating = movie?.rating !== null && movie?.rating !== undefined && movie?.rating !== "" && Number.isFinite(Number(movie.rating))
                ? Number(movie.rating).toFixed(1)
                : null;
              return (
                <li className={`series-timeline-item ${watched ? "is-watched" : ""} ${draggedId === title.id ? "is-dragged" : ""}`} key={title.id} draggable={editing} onDragStart={() => setDraggedId(title.id)} onDragOver={(event) => { if (editing) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); moveTitle(draggedId, title.id, timeline.id); setDraggedId(null); }} onDragEnd={() => setDraggedId(null)}>
                  <span className="series-timeline-node" aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span></span>
                  <Link className="series-timeline-film" to={`/movies/${encodeURIComponent(movie?.id || title.movieId)}`} aria-label={`Open details for ${movie?.title || title.title}`}>
                    <Poster className="series-timeline-poster" src={movie?.poster_url || title.posterPath} alt={`${movie?.title || title.title} poster`} loading="lazy" />
                    <span className="series-timeline-film-copy"><strong>{movie?.title || title.title}</strong><small className="series-timeline-meta"><span>{(movie?.release_date || title.releaseDate)?.slice(0, 4) || "Year unknown"}</span><span aria-hidden="true">·</span><span>{movie?.media_type === "series" || title.type === "series" ? "Series" : "Movie"}</span>{rating && <span className="series-timeline-rating">★ {rating}</span>}</small></span>
                  </Link>
                  <button className="series-note-toggle" type="button" aria-expanded={expandedNoteId === title.id} onClick={() => { setExpandedNoteId((current) => current === title.id ? null : title.id); setEditingNoteId(null); setNoteDraft(title.note || ""); }}><span>{expandedNoteId === title.id ? "Hide notes" : "View notes"}</span><span aria-hidden="true">{expandedNoteId === title.id ? "−" : "+"}</span></button>
                  {expandedNoteId === title.id && <div className="series-note-bubble"><span className="series-note-bubble-tail" aria-hidden="true" />{editingNoteId === title.id ? <label className="series-note-inline-editor"><span>Film note</span><textarea value={noteDraft} rows={4} maxLength={5000} autoFocus onChange={(event) => setNoteDraft(event.target.value)} placeholder="Write a note for this film…" /></label> : <p className={title.note ? "" : "series-note-empty"}>{title.note || "No note yet. Add a note for this film."}</p>}<div className="series-note-bubble-actions">{editingNoteId === title.id ? <><button type="button" onClick={() => saveSeriesNote(title)}><Save aria-hidden="true" /> Save</button><button type="button" onClick={() => { setEditingNoteId(null); setNoteDraft(title.note || ""); }}>Cancel</button></> : <button type="button" onClick={() => { setEditingNoteId(title.id); setNoteDraft(title.note || ""); }}><Pencil aria-hidden="true" /> {title.note ? "Edit note" : "Add note"}</button>}<button type="button" onClick={() => setSelectedTitleId(title.id)}>{watched ? "Log another viewing" : "Log viewing"}</button></div></div>}
                  <span className={`series-watched-status ${watched ? "is-watched" : ""}`}>{watched ? <><Check aria-hidden="true" /> Watched</> : "Not watched"}</span>
                  {editing && <div className="series-item-actions"><span className="series-drag-handle" aria-hidden="true"><ArrowUpDown /></span><button type="button" aria-label={`Move ${title.title} left`} disabled={index === 0} onClick={() => moveBy(title, -1, timeline.id, timelineTitles)}><ArrowLeft aria-hidden="true" /></button><button type="button" aria-label={`Move ${title.title} right`} disabled={index === timelineTitles.length - 1} onClick={() => moveBy(title, 1, timeline.id, timelineTitles)}><ArrowRight aria-hidden="true" /></button><button type="button" aria-label={`Remove ${title.title} from this timeline`} onClick={() => removeMovie(title)}><Trash2 aria-hidden="true" /></button></div>}
                </li>
              );
                  })}
                </ol>
              </div> : <div className="series-timeline-empty"><EmptyState>No movies in this timeline yet.</EmptyState></div>}
            </section>;
          })}
        </div>
        <Link className="series-back-link" to="/series">Back to all series</Link>
      </section>
      {editDetails && <CategoryFormModal existing={series} onClose={() => setEditDetails(false)} />}
      {deleteOpen && <Modal title="Delete this series?" onClose={() => setDeleteOpen(false)} className="series-delete-modal"><p><strong>{series.name}</strong> and its order and notes will be removed. The film records, categories, and watch history will stay in your library.</p><div className="form-actions"><button className="danger-button" type="button" onClick={deleteSeries}><Trash2 aria-hidden="true" /> Delete series</button><button className="secondary-button" type="button" onClick={() => setDeleteOpen(false)}>Cancel</button></div></Modal>}
      {timelineModalOpen && <Modal title={timelineModalMode === "rename" ? "Rename timeline" : "New timeline"} onClose={() => setTimelineModalOpen(false)} className="series-timeline-modal"><form onSubmit={timelineModalMode === "rename" ? renameTimeline : addTimeline}><label className="form-field"><span>Timeline name</span><input autoFocus required maxLength={80} value={timelineName} onChange={(event) => setTimelineName(event.target.value)} placeholder="e.g. Release order" /></label><div className="form-actions"><button className="primary-button" type="submit">{timelineModalMode === "rename" ? "Save name" : "Create timeline"}</button><button className="text-button" type="button" onClick={() => setTimelineModalOpen(false)}>Cancel</button></div></form></Modal>}
      {pickerOpen && <CategoryTitlePickerModal titles={titlesForTimeline(pickerTimelineId)} categoryName={timelines.find((timeline) => timeline.id === pickerTimelineId)?.name || series.name} sortOrder={titlesForTimeline(pickerTimelineId).length} onSave={(payload) => addMovie(payload, pickerTimelineId)} onClose={() => setPickerOpen(false)} />}
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
