import { ArrowLeft, Clapperboard, MonitorPlay, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MemoryGallery } from "../features/memories/MemoryGallery";
import { MemoryUploadModal } from "../features/memories/MemoryUploadModal";
import { MemoryViewerModal } from "../features/memories/MemoryViewerModal";
import { useArchive } from "../context/ArchiveContext";
import { useToast } from "../context/ToastContext";
import { archiveService } from "../services/archive.service";
import { Poster } from "../components/ui/Poster";
import { ErrorState, LoadingState } from "../components/ui/States";
import {
  booleanValue,
  formatDate,
  formatRating,
  formatRuntime,
  today,
} from "../utils/formatters";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useEscape } from "../hooks/useEscape";

export default function MovieDetailPage() {
  const { movieId } = useParams();
  const { movies, history, memories, loading, error, refresh } = useArchive();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const movie = movies.find((item) => String(item.id) === String(movieId));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeMemory, setActiveMemory] = useState(null);
  const [viewing, setViewing] = useState({
    watched_at: today(),
    watched_in_theater: false,
  });
  const [edit, setEdit] = useState(null);
  const [viewingBusy, setViewingBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  useEscape(
    () => {
      if (activeMemory) setActiveMemory(null);
      else if (uploadOpen) setUploadOpen(false);
    },
    Boolean(activeMemory || uploadOpen),
  );
  useDocumentTitle(movie?.title || "Movie detail");
  useEffect(() => {
    if (movie)
      setEdit({
        title: movie.title,
        status: movie.status,
        rating: movie.rating ?? "",
        review: movie.review || "",
      });
  }, [movie]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const saved = Number(params.get("memory_saved") || 0);
    const failed = Number(params.get("memory_failed") || 0);
    if (!saved && !failed) return;
    if (failed)
      toast(
        `${saved} memories saved. ${failed} need to be retried from this page.`,
        "error",
      );
    else toast(`${saved} ${saved === 1 ? "memory" : "memories"} saved.`);
    params.delete("memory_saved");
    params.delete("memory_failed");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, toast]);
  const viewings = useMemo(
    () =>
      movie
        ? history
            .filter((entry) => String(entry.movie_id) === String(movie.id))
            .sort((a, b) =>
              String(b.watched_at).localeCompare(String(a.watched_at)),
            )
        : [],
    [history, movie],
  );
  const movieMemories = useMemo(
    () =>
      movie
        ? memories
            .filter((memory) => String(memory.movie_id) === String(movie.id))
            .sort(
              (a, b) =>
                Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
                String(a.created_at || "").localeCompare(
                  String(b.created_at || ""),
                ),
            )
        : [],
    [memories, movie],
  );
  async function addViewing(event) {
    event.preventDefault();
    if (viewingBusy) return;
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    setViewingBusy(true);
    try {
      await archiveService.writeAction(
        "addViewing",
        { movie_id: movie.id, ...viewing },
        pin,
      );
      await refresh();
      toast("Viewing added to history.");
    } catch (nextError) {
      toast(nextError.message, "error");
    } finally {
      setViewingBusy(false);
    }
  }
  async function saveEdit(event) {
    event.preventDefault();
    if (editBusy) return;
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    setEditBusy(true);
    try {
      await archiveService.writeAction(
        "updateMovie",
        {
          id: movie.id,
          title: edit.title.trim(),
          status: edit.status,
          rating: edit.rating === "" ? null : Number(edit.rating),
          review: edit.review.trim() || null,
        },
        pin,
      );
      await refresh();
      toast("Movie entry updated.");
    } catch (nextError) {
      toast(nextError.message, "error");
    } finally {
      setEditBusy(false);
    }
  }
  if (loading)
    return (
      <section className="detail-page page-shell">
        <LoadingState>Loading movie details…</LoadingState>
      </section>
    );
  if (error || !movie)
    return (
      <section className="detail-page page-shell">
        <ErrorState>
          This movie could not be found.
          <br />
          <Link className="section-link" to="/">
            Return home
          </Link>
        </ErrorState>
      </section>
    );
  return (
    <section className="detail-page page-shell">
      <Link className="detail-back" to="/">
        <ArrowLeft aria-hidden="true" />
        Back to archive
      </Link>
      <div className="detail-layout">
        <div className="detail-poster">
          <Poster src={movie.poster_url} alt={`${movie.title} poster`} />
        </div>
        <div className="detail-content">
          <p className="eyebrow">
            {movie.status} · {movie.media_type}
          </p>
          <h1>{movie.title}</h1>
          <div className="detail-facts">
            <span className="detail-fact">
              {movie.release_date?.slice(0, 4) || "Release TBA"}
            </span>
            <span className="detail-fact">
              {formatRuntime(movie.runtime_minutes)}
            </span>
            <span className="detail-fact">
              ★ {formatRating(movie.rating)} / 10
            </span>
            <span className="detail-fact">
              {movie.external_source === "tmdb" ? "TMDB entry" : "Manual entry"}
            </span>
          </div>
          <section className="review-block">
            <p className="section-kicker">Review & impression</p>
            <h2>What stayed</h2>
            <p className="review-copy">
              {movie.review
                ? `“${movie.review}”`
                : "No impression has been written yet."}
            </p>
          </section>
          <MemoryGallery
            memories={movieMemories}
            onAdd={() => setUploadOpen(true)}
            onOpen={setActiveMemory}
          />
          <section className="viewing-block">
            <p className="section-kicker">Screenings</p>
            <h2>Viewing history</h2>
            {viewings.length ? (
              <div className="viewing-list">
                {viewings.map((entry) => (
                  <div className="viewing-item" key={entry.id}>
                    <div>
                      <p>
                        {formatDate(entry.watched_at, {
                          fallback: "Date unknown",
                        })}
                      </p>
                      <span>
                        {booleanValue(entry.watched_in_theater)
                          ? "Watched in a theater"
                          : "Watched elsewhere"}
                      </span>
                    </div>
                    {booleanValue(entry.watched_in_theater) ? (
                      <Clapperboard aria-hidden="true" />
                    ) : (
                      <MonitorPlay aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="collection-status">No viewing entries yet.</p>
            )}
            <form
              className="form-grid"
              style={{ marginTop: 24 }}
              onSubmit={addViewing}
            >
              <label className="form-field">
                <span>Watched on</span>
                <input
                  type="date"
                  required
                  value={viewing.watched_at}
                  onChange={(e) =>
                    setViewing((value) => ({
                      ...value,
                      watched_at: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={viewing.watched_in_theater}
                  onChange={(e) =>
                    setViewing((value) => ({
                      ...value,
                      watched_in_theater: e.target.checked,
                    }))
                  }
                />
                Watched in a theater
              </label>
              <div className="form-actions is-full">
                <button
                  className="secondary-button"
                  type="submit"
                  disabled={viewingBusy}
                >
                  <Plus aria-hidden="true" />
                  {viewingBusy ? "Adding…" : "Add viewing"}
                </button>
              </div>
            </form>
          </section>
          {edit && (
            <section className="edit-block">
              <p className="section-kicker">Personal notes</p>
              <h2>Edit this entry</h2>
              <form className="form-grid" onSubmit={saveEdit}>
                <label className="form-field is-full">
                  <span>Title</span>
                  <input
                    required
                    value={edit.title}
                    onChange={(e) =>
                      setEdit((value) => ({ ...value, title: e.target.value }))
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Status</span>
                  <select
                    value={edit.status}
                    onChange={(e) =>
                      setEdit((value) => ({ ...value, status: e.target.value }))
                    }
                  >
                    <option value="plan">Planned</option>
                    <option value="watchlist">Watchlist</option>
                    <option value="watched">Watched</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Rating (0–10)</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={edit.rating}
                    onChange={(e) =>
                      setEdit((value) => ({ ...value, rating: e.target.value }))
                    }
                  />
                </label>
                <label className="form-field is-full">
                  <span>Review or impression</span>
                  <textarea
                    value={edit.review}
                    onChange={(e) =>
                      setEdit((value) => ({ ...value, review: e.target.value }))
                    }
                  />
                </label>
                <div className="form-actions is-full">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={editBusy}
                  >
                    <Save aria-hidden="true" />
                    {editBusy ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
      {uploadOpen && (
        <MemoryUploadModal
          movieId={movie.id}
          sortOffset={movieMemories.length}
          onClose={() => setUploadOpen(false)}
          onSaved={refresh}
        />
      )}{" "}
      {activeMemory && (
        <MemoryViewerModal
          memory={activeMemory}
          movieTitle={movie.title}
          onClose={() => setActiveMemory(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
