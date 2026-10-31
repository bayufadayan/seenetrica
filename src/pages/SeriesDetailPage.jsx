import { ArrowDown, ArrowUp, ArrowUpDown, Check, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { Poster } from "../components/ui/Poster";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useArchive } from "../context/ArchiveContext";
import { useToast } from "../context/ToastContext";
import { CategoryFormModal } from "../features/categories/components/CategoryFormModal";
import { CategoryIcon } from "../features/categories/components/CategoryIcon";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { today } from "../utils/formatters";
import "../features/categories/styles/series.css";

export default function SeriesDetailPage() {
  const { categorySlug } = useParams();
  const categories = useCategories();
  const { movies, history, loading: archiveLoading, error: archiveError } = useArchive();
  const toast = useToast();
  const series = categories.categories.find((item) => item.slug === categorySlug && item.kind === "series");
  useDocumentTitle(series?.name || "Series");
  const [editing, setEditing] = useState(false);
  const [editDetails, setEditDetails] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTitleId, setSelectedTitleId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const titles = useMemo(() => categories.titles
    .filter((title) => title.categoryId === series?.id && !title.deletedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)), [categories.titles, series?.id]);
  const movieById = useMemo(() => new Map(movies.map((movie) => [String(movie.id), movie])), [movies]);
  const watchedMovieIds = useMemo(() => new Set(history.map((entry) => String(entry.movie_id))), [history]);
  const selectedTitle = titles.find((title) => title.id === selectedTitleId) || null;

  async function addMovie(movie) {
    if (!series || titles.some((title) => String(title.movieId) === String(movie.id))) return;
    try {
      await categories.createTitle(series.id, {
        movieId: movie.id,
        tmdbId: movie.external_source === "tmdb" ? movie.external_id : null,
        title: movie.title,
        baseTitle: movie.base_title || movie.title,
        originalTitle: movie.original_title || movie.title,
        releaseDate: movie.release_date,
        type: movie.media_type || "movie",
        runtimeMinutes: movie.runtime_minutes,
        posterPath: movie.poster_path || movie.poster_url,
        backdropPath: movie.backdrop_path,
        identityKey: `archive:${movie.id}`,
        sortOrder: titles.length,
        isWatched: movie.status === "watched" || watchedMovieIds.has(String(movie.id)),
        note: "",
      });
      toast(`${movie.title} added to ${series.name}.`);
    } catch (error) {
      toast(error.message, "error");
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
      <section className="page-hero page-shell series-detail-hero">
        <div className="series-detail-icon"><CategoryIcon category={series} /></div>
        <div className="series-detail-copy"><p className="eyebrow">Watch order · {titles.length} titles</p><h1>{series.name}<span>.</span></h1><p className="page-hero-description">Films in your chosen order. Select a film to open its note.</p></div>
        <div className="series-detail-actions">
          <button className={editing ? "secondary-button" : "primary-button"} type="button" onClick={() => setEditing((value) => !value)}>{editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}{editing ? "Done" : "Edit"}</button>
          {editing && <button className="secondary-button" type="button" onClick={() => setEditDetails(true)}>Name & image</button>}
        </div>
      </section>
      <section className="page-shell page-content series-detail-page">
        <div className="series-order-heading"><span>{editing ? "Drag titles to change the timeline" : "Your timeline"}</span>{editing && <button className="secondary-button" type="button" onClick={() => setPickerOpen(true)}><Plus aria-hidden="true" /> Add from All Movies</button>}</div>
        {archiveError && <p className="series-offline-note" role="status">Showing saved series. Movie details may be unavailable until the archive reconnects.</p>}
        {titles.length ? (
          <ol className={`series-timeline ${editing ? "is-editing" : ""}`}>
            {titles.map((title, index) => {
              const movie = movieById.get(String(title.movieId));
              const watched = title.isWatched || watchedMovieIds.has(String(title.movieId)) || movie?.status === "watched";
              return (
                <li className="series-timeline-item" key={title.id} draggable={editing} onDragStart={() => setDraggedId(title.id)} onDragOver={(event) => { if (editing) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); moveTitle(draggedId, title.id); setDraggedId(null); }} onDragEnd={() => setDraggedId(null)}>
                  {editing && <span className="series-drag-handle" aria-hidden="true"><ArrowUpDown /></span>}
                  <span className="series-order-number">{String(index + 1).padStart(2, "0")}</span>
                  <button className="series-movie-poster-button" type="button" aria-label={`Open note for ${movie?.title || title.title}`} onClick={() => setSelectedTitleId(title.id)}><Poster className="series-movie-poster" src={movie?.poster_url || title.posterPath} alt="" loading="lazy" /></button>
                  <button className="series-movie-open" type="button" onClick={() => setSelectedTitleId(title.id)}>
                    <strong>{movie?.title || title.title}</strong>
                    <span>{(movie?.release_date || title.releaseDate)?.slice(0, 4) || "Year unknown"} · {movie?.media_type === "series" || title.type === "series" ? "Series" : "Movie"}</span>
                    {title.note && <small>Note saved</small>}
                  </button>
                  <span className={`series-watched-status ${watched ? "is-watched" : ""}`}>{watched ? <><Check aria-hidden="true" /> Watched</> : "Not watched"}</span>
                  {editing && <div className="series-item-actions"><button type="button" aria-label={`Move ${title.title} up`} disabled={index === 0} onClick={() => moveBy(title, -1)}><ArrowUp aria-hidden="true" /></button><button type="button" aria-label={`Move ${title.title} down`} disabled={index === titles.length - 1} onClick={() => moveBy(title, 1)}><ArrowDown aria-hidden="true" /></button><button type="button" aria-label={`Remove ${title.title} from this series`} onClick={() => removeMovie(title)}><Trash2 aria-hidden="true" /></button></div>}
                </li>
              );
            })}
          </ol>
        ) : <EmptyState>This series is empty. Edit it to add films from All Movies.</EmptyState>}
        <Link className="series-back-link" to="/series">Back to all series</Link>
      </section>
      {editDetails && <CategoryFormModal existing={series} onClose={() => setEditDetails(false)} />}
      {pickerOpen && <SeriesMoviePicker movies={movies} usedIds={new Set(titles.map((title) => String(title.movieId)))} onAdd={addMovie} onClose={() => setPickerOpen(false)} />}
      {selectedTitle && <SeriesNoteModal title={selectedTitle} movie={movieById.get(String(selectedTitle.movieId))} watched={selectedTitle.isWatched || watchedMovieIds.has(String(selectedTitle.movieId)) || movieById.get(String(selectedTitle.movieId))?.status === "watched"} onSaveNote={async (note) => { try { await categories.updateTitle(selectedTitle.id, { note }); toast("Note saved."); } catch (error) { toast(error.message, "error"); throw error; } }} onMarkWatched={markWatched} onClose={() => setSelectedTitleId(null)} />}
    </>
  );
}

function SeriesMoviePicker({ movies, usedIds, onAdd, onClose }) {
  const [search, setSearch] = useState("");
  const results = movies.filter((movie) => !usedIds.has(String(movie.id)) && (!search.trim() || String(movie.title || "").toLowerCase().includes(search.trim().toLowerCase()))).slice(0, 40);
  return <Modal title="Add films from All Movies" onClose={onClose} className="series-picker-modal"><label className="form-field"><span>Search your movie library</span><input type="search" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles" /></label><div className="series-picker-results">{results.map((movie) => <button className="series-picker-row" key={movie.id} type="button" onClick={() => onAdd(movie)}><Poster src={movie.poster_url} alt="" /><span><strong>{movie.title}</strong><small>{movie.release_date?.slice(0, 4) || "Year unknown"} · {movie.media_type || "movie"}</small></span><Plus aria-hidden="true" /></button>)}{!results.length && <p className="collection-status">No matching titles. Add the film to All Movies first.</p>}</div><div className="form-actions"><Link className="text-button" to="/add-movie">Add a missing film</Link><button className="secondary-button" type="button" onClick={onClose}>Done</button></div></Modal>;
}

function SeriesNoteModal({ title, movie, watched, onSaveNote, onMarkWatched, onClose }) {
  const [note, setNote] = useState(title.note || "");
  const [editingNote, setEditingNote] = useState(false);
  const [watchedAt, setWatchedAt] = useState(today());
  const [theater, setTheater] = useState(false);
  const [busy, setBusy] = useState(false);
  const displayTitle = movie?.title || title.title;

  async function saveNote() {
    setBusy(true);
    try { await onSaveNote(note); setEditingNote(false); }
    catch { /* The parent reports the save error and keeps the editor open. */ }
    finally { setBusy(false); }
  }

  async function saveViewing() {
    setBusy(true);
    try { await onMarkWatched(title, watchedAt, theater); }
    finally { setBusy(false); }
  }

  return <Modal title={`${displayTitle} · Note`} onClose={onClose} busy={busy} className="series-note-modal"><div className="series-note-meta">{movie?.release_date?.slice(0, 4) || title.releaseDate?.slice(0, 4) || "Year unknown"} · {movie?.media_type === "series" || title.type === "series" ? "Series" : "Movie"}</div>{editingNote ? <label className="form-field"><span>Film note</span><textarea value={note} maxLength={5000} rows={6} autoFocus onChange={(event) => setNote(event.target.value)} placeholder="Write your note for this film…" /></label> : <div className="series-note-text">{note.trim() || <span className="series-note-empty">No note yet. Add a note for this film.</span>}</div>}<div className="series-note-actions">{editingNote ? <><button className="primary-button" type="button" disabled={busy} onClick={saveNote}><Save aria-hidden="true" /> Save note</button><button className="text-button" type="button" disabled={busy} onClick={() => { setNote(title.note || ""); setEditingNote(false); }}>Cancel</button></> : <button className="secondary-button" type="button" onClick={() => setEditingNote(true)}><Pencil aria-hidden="true" /> {note ? "Edit note" : "Add note"}</button>}</div><div className="series-note-viewing"><h3>Viewing history</h3>{watched && <p className="series-already-watched"><Check aria-hidden="true" /> This film is already marked watched.</p>}<label className="form-field"><span>Watched on</span><input type="date" required value={watchedAt} onChange={(event) => setWatchedAt(event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={theater} onChange={(event) => setTheater(event.target.checked)} />Watched in a theater</label><button className="primary-button" type="button" disabled={busy || !watchedAt} onClick={saveViewing}>{busy ? "Saving…" : watched ? "Log another viewing" : "Mark watched"}</button><p className="series-note-hint">This viewing will be added to your History.</p></div></Modal>;
}
