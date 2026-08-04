import {
  Check,
  Images,
  Info,
  Layers3,
  Mic,
  PenLine,
  Plus,
  SquarePlus,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MemoryDraftList } from "../features/memories/MemoryDraftList";
import { useMemoryDrafts } from "../features/memories/useMemoryDrafts";
import { TmdbSearchPanel } from "../features/movies/TmdbSearchPanel";
import { useSpeechRecognition } from "../features/movies/useSpeechRecognition";
import { useArchive } from "../context/ArchiveContext";
import { useToast } from "../context/ToastContext";
import { archiveService } from "../services/archive.service";
import { memoriesService } from "../services/memories.service";
import { FALLBACK_POSTER } from "../utils/constants";
import { formatMonth, today } from "../utils/formatters";
import { Poster } from "../components/ui/Poster";
import { useBodyLock } from "../hooks/useBodyLock";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const manualMovie = {
  external_source: "manual",
  external_id: null,
  title: "",
  poster_url: "",
  release_date: "",
  media_type: "movie",
  runtime_minutes: "",
};

function launchPreset(params) {
  const intent = (params.get("intent") || "").toLowerCase();
  const requested = (params.get("status") || "").toLowerCase();
  const period = params.get("period") || "";
  const watchedAt = params.get("watched_at") || "";
  return {
    status: ["plan", "watchlist", "watched"].includes(requested)
      ? requested
      : ["watched", "theater"].includes(intent)
        ? "watched"
        : "watchlist",
    inTheater:
      intent === "theater" || ["1", "true"].includes(params.get("theater")),
    period: /^\d{4}-\d{2}$/.test(period) ? period : "",
    watchedAt: /^\d{4}-\d{2}-\d{2}$/.test(watchedAt) ? watchedAt : "",
  };
}

function lastDate(period) {
  if (!period) return "";
  const [year, month] = period.split("-").map(Number);
  return `${period}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
}
function emptyForm(preset) {
  return {
    title: "",
    media_type: "movie",
    release_date: "",
    runtime_minutes: "",
    status: preset.status,
    poster_url: "",
    rating: "",
    watched_at: preset.period
      ? today().startsWith(preset.period)
        ? today()
        : ""
      : preset.watchedAt || today(),
    watched_in_theater: preset.inTheater,
    review: "",
  };
}
function clientId() {
  return (
    window.crypto?.randomUUID?.() ||
    `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}

export default function AddMoviePage() {
  useDocumentTitle("Add movies");
  const [params] = useSearchParams();
  const preset = useMemo(() => launchPreset(params), [params]);
  const [mode, setMode] = useState("single");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(() => emptyForm(preset));
  const [saving, setSaving] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const drafts = useMemoryDrafts();
  const { refresh } = useArchive();
  const toast = useToast();
  const navigate = useNavigate();
  const submitGuard = useRef(false);

  const speechChange = useCallback(
    (review) => setForm((current) => ({ ...current, review })),
    [],
  );
  const speechError = useCallback(
    (message) => toast(message, "error"),
    [toast],
  );
  const speech = useSpeechRecognition(form.review, speechChange, speechError);

  function openForm(movie) {
    speech.stop();
    drafts.clear();
    setSelected(movie);
    setForm({
      ...emptyForm(preset),
      title: movie.title || "",
      media_type: movie.media_type || "movie",
      release_date: movie.release_date || "",
      runtime_minutes: movie.runtime_minutes || "",
      poster_url: movie.poster_url || "",
    });
  }
  function clearSelection() {
    speech.stop();
    drafts.clear();
    setSelected(null);
    setForm(emptyForm(preset));
  }
  function change(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function uploadDrafts(movieId, pin) {
    const saved = [];
    const failures = [];
    for (let index = 0; index < drafts.drafts.length; index += 1) {
      const draft = drafts.drafts[index];
      drafts.update(draft.client_id, {
        status: "preparing",
        status_message: "Preparing media…",
      });
      setOverlay({
        message: `Preparing memory ${index + 1} of ${drafts.drafts.length}…`,
        detail: draft.file.name,
      });
      try {
        saved.push(
          await memoriesService.uploadDraft(draft, movieId, pin, index),
        );
        drafts.update(draft.client_id, {
          status: "done",
          status_message: "Saved",
        });
      } catch (error) {
        failures.push(error);
        drafts.update(draft.client_id, {
          status: "error",
          status_message: error.message,
        });
      }
    }
    return { saved, failures };
  }

  async function submit(event) {
    event.preventDefault();
    if (submitGuard.current) return;
    await speech.stop();
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    submitGuard.current = true;
    setSaving(true);
    setOverlay({
      message: "Saving your movie to Seenetrica…",
      detail: "Please keep this page open.",
    });
    const movie = {
      external_source: selected?.external_source || "manual",
      external_id: selected?.external_id ?? null,
      title: form.title.trim(),
      poster_url: form.poster_url.trim() || null,
      release_date: form.release_date || null,
      media_type: form.media_type,
      runtime_minutes: form.runtime_minutes
        ? Number(form.runtime_minutes)
        : null,
      status: form.status,
      rating: form.rating === "" ? null : Number(form.rating),
      review: form.review.trim() || null,
    };
    const viewing =
      form.status === "watched"
        ? {
            watched_at: form.watched_at,
            watched_in_theater: form.watched_in_theater,
          }
        : null;
    try {
      const saved = await archiveService.writeAction(
        "createMovie",
        { movie, viewing },
        pin,
      );
      const media = drafts.drafts.length
        ? await uploadDrafts(saved.movie.id, pin)
        : { saved: [], failures: [] };
      await refresh();
      toast(
        media.failures.length
          ? "Movie saved. Some memories need to be retried."
          : "Movie added to Seenetrica.",
        media.failures.length ? "error" : "success",
      );
      navigate(
        `/movies/${encodeURIComponent(saved.movie.id)}?${new URLSearchParams({ ...(media.saved.length ? { memory_saved: String(media.saved.length) } : {}), ...(media.failures.length ? { memory_failed: String(media.failures.length) } : {}) })}`.replace(
          /\?$/,
          "",
        ),
      );
    } catch (error) {
      toast(error.message, "error");
      setOverlay(null);
      setSaving(false);
      submitGuard.current = false;
    }
  }

  const description =
    mode === "bulk"
      ? "Choose a month, build a list from TMDB, review it, then save everything together."
      : preset.inTheater
        ? "Search a title and it will be prepared as a theater viewing for today."
        : preset.period
          ? `Add a watched title to ${formatMonth(preset.period)}. Choose the exact day before saving.`
          : "Search TMDB for the basic details, then make the entry yours.";
  return (
    <>
      <section className="page-hero page-shell add-page-hero">
        <div>
          <p className="eyebrow">Grow your archive</p>
          <h1>
            Add a <span>title.</span>
          </h1>
          <p className="page-hero-description">{description}</p>
        </div>
        <div className="add-mode-action">
          <button
            className="secondary-button add-mode-toggle"
            type="button"
            aria-pressed={mode === "bulk"}
            onClick={() => {
              speech.stop();
              setMode((value) => (value === "single" ? "bulk" : "single"));
            }}
          >
            {mode === "bulk" ? (
              <SquarePlus aria-hidden="true" />
            ) : (
              <Layers3 aria-hidden="true" />
            )}
            <span>
              {mode === "bulk" ? "Add one title" : "Add movies by month"}
            </span>
          </button>
          <p>
            {mode === "bulk"
              ? "Return to the regular form for a single detailed entry."
              : "Useful when you want to backfill several titles from the same month."}
          </p>
        </div>
      </section>
      {mode === "single" ? (
        <section className="add-layout page-shell">
          <div className="add-panel">
            <h2>Find on TMDB</h2>
            <TmdbSearchPanel onSelect={openForm} />
            <div className="manual-divider">or</div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => openForm(manualMovie)}
            >
              <PenLine aria-hidden="true" />
              Enter details manually
            </button>
          </div>
          <div className="add-panel is-sticky">
            <h2>Complete the entry</h2>
            {!selected ? (
              <div className="empty-state">
                Choose a TMDB result or start a manual entry.
              </div>
            ) : (
              <SingleForm
                form={form}
                change={change}
                submit={submit}
                saving={saving}
                preset={preset}
                drafts={drafts}
                speech={speech}
                onCancel={clearSelection}
              />
            )}
          </div>
        </section>
      ) : (
        <BulkMode onOverlay={setOverlay} />
      )}
      {overlay && (
        <div className="save-overlay" role="status" aria-live="assertive">
          <div className="save-overlay-card">
            <span className="loading-spinner" aria-hidden="true" />
            <strong>{overlay.message}</strong>
            <p>{overlay.detail}</p>
          </div>
        </div>
      )}
    </>
  );
}

function SingleForm({
  form,
  change,
  submit,
  saving,
  preset,
  drafts,
  speech,
  onCancel,
}) {
  const [language, setLanguage] = useState("id-ID");
  const [memoryStatus, setMemoryStatus] = useState(
    "Photos stay HD up to 3200 px. Videos are uploaded in their original quality.",
  );
  function files(event) {
    const selected = Array.from(event.target.files || []);
    const errors = drafts.addFiles(selected);
    event.target.value = "";
    setMemoryStatus(
      errors.length
        ? errors.join(" ")
        : `${Math.min(drafts.drafts.length + selected.length, drafts.maxFiles)} of ${drafts.maxFiles} media memories prepared.`,
    );
  }
  return (
    <form onSubmit={submit}>
      <div className="selected-preview">
        <Poster src={form.poster_url || FALLBACK_POSTER} alt="" />
        <div>
          <h3>{form.title || "Untitled"}</h3>
          <p>
            {form.media_type} ·{" "}
            {form.release_date?.slice(0, 4) || "Release TBA"}
          </p>
        </div>
      </div>
      <div className="form-grid">
        <Field full label="Title">
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => change("title", e.target.value)}
          />
        </Field>
        <Field label="Type">
          <select
            required
            value={form.media_type}
            onChange={(e) => change("media_type", e.target.value)}
          >
            <option value="movie">Movie</option>
            <option value="series">Series</option>
          </select>
        </Field>
        <Field label="Release date">
          <input
            type="date"
            value={form.release_date}
            onChange={(e) => change("release_date", e.target.value)}
          />
        </Field>
        <Field label="Runtime (minutes)">
          <input
            type="number"
            min="1"
            value={form.runtime_minutes}
            onChange={(e) => change("runtime_minutes", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            required
            value={form.status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="watchlist">Watchlist</option>
            <option value="plan">Planned</option>
            <option value="watched">Watched</option>
          </select>
        </Field>
        <Field full label="Poster URL">
          <input
            type="url"
            value={form.poster_url}
            onChange={(e) => change("poster_url", e.target.value)}
          />
        </Field>
        <Field label="Your rating (0–10)">
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={form.rating}
            onChange={(e) => change("rating", e.target.value)}
          />
        </Field>
        {form.status === "watched" && (
          <>
            <Field label="Watched on">
              <input
                type="date"
                required
                min={preset.period ? `${preset.period}-01` : undefined}
                max={lastDate(preset.period) || undefined}
                value={form.watched_at}
                onChange={(e) => change("watched_at", e.target.value)}
              />
            </Field>
            <label className="checkbox-field is-full">
              <input
                type="checkbox"
                checked={form.watched_in_theater}
                onChange={(e) => change("watched_in_theater", e.target.checked)}
              />
              Watched in a theater
            </label>
          </>
        )}
        <div className="form-field is-full review-field">
          <div className="review-field-header">
            <label className="form-label" htmlFor="review">
              Review or impression
            </label>
            <div className="speech-tools">
              <select
                className="speech-language"
                aria-label="Speech language"
                disabled={!speech.supported || speech.listening}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="id-ID">Bahasa Indonesia</option>
                <option value="en-US">English</option>
              </select>
              <button
                className={`speech-button ${speech.listening ? "is-listening" : ""}`}
                type="button"
                disabled={!speech.supported}
                aria-pressed={speech.listening}
                onClick={() => speech.toggle(language)}
              >
                <Mic aria-hidden="true" />
                <span>
                  {speech.listening ? "Stop recording" : "Speak review"}
                </span>
              </button>
            </div>
          </div>
          <div className="review-input-wrap">
            <textarea
              id="review"
              value={form.review}
              placeholder="What stayed with you?"
              onChange={(e) => change("review", e.target.value)}
            />
            {speech.listening && (
              <div className="speech-live-indicator">
                <span className="speech-live-dot" />
                Listening
              </div>
            )}
          </div>
          <p className="speech-status" role="status">
            {speech.status}
          </p>
        </div>
      </div>
      <section
        className="memory-entry-block"
        aria-labelledby="add-memory-heading"
      >
        <div className="memory-entry-heading">
          <div>
            <h3 id="add-memory-heading">Add media from this experience</h3>
            <p>
              Tickets, cinema photos, short videos, posters, or screenshots. The
              movie is saved first, then this media is attached to it.
            </p>
          </div>
          <label className="secondary-button memory-file-button">
            <Images aria-hidden="true" />
            Choose media
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v"
              multiple
              disabled={saving}
              onChange={files}
            />
          </label>
        </div>
        <div className="memory-drafts">
          <MemoryDraftList manager={drafts} disabled={saving} />
        </div>
        <p
          className={`memory-helper ${memoryStatus.includes("larger") || memoryStatus.includes("Only") ? "is-error" : ""}`}
          role="status"
        >
          {memoryStatus}
        </p>
      </section>
      <div className="form-actions">
        <button
          className={`primary-button ${saving ? "is-loading" : ""}`}
          type="submit"
          disabled={saving}
          aria-busy={saving}
        >
          <Plus aria-hidden="true" />
          <span className="button-spinner" hidden={!saving} />
          <span>{saving ? "Saving movie…" : "Add to Seenetrica"}</span>
        </button>
        <button
          className="text-button"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, full = false, children }) {
  return (
    <label className={`form-field ${full ? "is-full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function BulkMode({ onOverlay }) {
  const [period, setPeriod] = useState("");
  const [queue, setQueue] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useArchive();
  useBodyLock(Boolean(editing));
  function add(movie) {
    setQueue((items) => [
      ...items,
      {
        client_id: clientId(),
        external_source: movie.external_source || "tmdb",
        external_id: movie.external_id ?? null,
        title: movie.title || "",
        poster_url: movie.poster_url || null,
        release_date: movie.release_date || null,
        media_type: movie.media_type || "movie",
        runtime_minutes: movie.runtime_minutes || "",
        rating: "",
        review: "",
        watched_at: "",
        watched_in_theater: false,
      },
    ]);
    toast(`${movie.title} added to the batch.`);
  }
  function changePeriod(value) {
    if (period && value !== period && queue.some((item) => item.watched_at)) {
      setQueue((items) =>
        items.map((item) => ({
          ...item,
          watched_at: item.watched_at.startsWith(`${value}-`)
            ? item.watched_at
            : "",
        })),
      );
      toast(
        "Exact dates outside the new month were cleared. Review the pencil fields if needed.",
      );
    }
    setPeriod(value);
  }
  async function save() {
    if (saving || !period || !queue.length) return;
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    setSaving(true);
    const saved = [];
    const failures = [];
    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      onOverlay({
        message: `Saving ${index + 1} of ${queue.length}`,
        detail: item.title,
      });
      try {
        await archiveService.writeAction(
          "createMovie",
          {
            movie: {
              external_source: item.external_source,
              external_id: item.external_id,
              title: item.title,
              poster_url: item.poster_url,
              release_date: item.release_date,
              media_type: item.media_type,
              runtime_minutes: item.runtime_minutes
                ? Number(item.runtime_minutes)
                : null,
              status: "watched",
              rating: item.rating === "" ? null : Number(item.rating),
              review: item.review.trim() || null,
            },
            viewing: {
              watched_at: item.watched_at || `${period}-01`,
              watched_in_theater: item.watched_in_theater,
            },
          },
          pin,
        );
        saved.push(item.client_id);
      } catch (error) {
        failures.push(error);
        if (/pin|unauthor|forbidden/i.test(error.message)) break;
      }
    }
    setQueue((items) =>
      items.filter((item) => !saved.includes(item.client_id)),
    );
    setSaving(false);
    onOverlay(null);
    await refresh().catch(() => {});
    if (!failures.length) {
      toast("Monthly batch saved.");
      navigate("/history");
    } else
      toast(
        `${saved.length} saved, ${queue.length - saved.length} still in the list. ${failures[0].message}`,
        "error",
      );
  }
  return (
    <section className="bulk-add-shell page-shell">
      <div className="bulk-period-card">
        <div>
          <h2>Choose the viewing month</h2>
          <p>
            Every title in this batch will be saved as watched during this
            month. You can still set an exact day from the pencil button.
          </p>
        </div>
        <Field label="Month and year">
          <input
            type="month"
            required
            disabled={saving}
            value={period}
            onChange={(e) => changePeriod(e.target.value)}
          />
        </Field>
      </div>
      <div className="bulk-workspace">
        <div className="add-panel">
          <h2>Find titles</h2>
          <TmdbSearchPanel bulk disabled={!period || saving} onSelect={add} />
        </div>
        <div className="add-panel bulk-queue-panel is-sticky">
          <div className="bulk-queue-heading">
            <div>
              <h2>Review the batch</h2>
            </div>
            <span className="bulk-count">
              {queue.length} {queue.length === 1 ? "title" : "titles"}
            </span>
          </div>
          <p className="bulk-period-summary">
            {period
              ? `${formatMonth(period)} · all items are saved as watched`
              : "Select a month to start building this batch."}
          </p>
          <div className="bulk-queue">
            {queue.length ? (
              queue.map((item, index) => (
                <article className="bulk-queue-item" key={item.client_id}>
                  <span className="bulk-queue-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Poster src={item.poster_url} alt="" />
                  <div className="bulk-queue-copy">
                    <h3>{item.title}</h3>
                    <p>
                      {item.media_type} ·{" "}
                      {item.release_date?.slice(0, 4) || "TBA"}
                    </p>
                    <div className="bulk-item-facts">
                      <span>{item.watched_at || "Exact day not set"}</span>
                      <span>
                        {item.rating === "" ? "No rating" : `${item.rating}/10`}
                      </span>
                    </div>
                  </div>
                  <div className="bulk-item-actions">
                    <button
                      className="bulk-icon-button"
                      type="button"
                      disabled={saving}
                      aria-label={`Edit ${item.title}`}
                      onClick={() => setEditing({ ...item })}
                    >
                      <PenLine aria-hidden="true" />
                    </button>
                    <button
                      className="bulk-icon-button is-danger"
                      type="button"
                      disabled={saving}
                      aria-label={`Remove ${item.title}`}
                      onClick={() =>
                        setQueue((items) =>
                          items.filter(
                            (entry) => entry.client_id !== item.client_id,
                          ),
                        )
                      }
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="bulk-queue-empty">
                <Plus aria-hidden="true" />
                <p>
                  Your selected titles will appear here before anything is
                  saved.
                </p>
              </div>
            )}
          </div>
          <div className="bulk-date-note">
            <Info aria-hidden="true" />
            <p>
              The current archive format needs a complete date. When an exact
              day is not set, the title is stored on the first day of the
              selected month.
            </p>
          </div>
          <div className="bulk-actions">
            <button
              className={`primary-button bulk-save-button ${saving ? "is-loading" : ""}`}
              type="button"
              disabled={!period || !queue.length || saving}
              onClick={save}
            >
              <Upload aria-hidden="true" />
              {saving
                ? "Saving batch…"
                : `Save ${queue.length || ""} ${queue.length === 1 ? "title" : "titles"}`}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={!queue.length || saving}
              onClick={() =>
                window.confirm(
                  "Remove every title from this batch? Nothing has been saved yet.",
                ) && setQueue([])
              }
            >
              Clear list
            </button>
          </div>
        </div>
      </div>
      {editing && (
        <BatchEdit
          item={editing}
          period={period}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setQueue((items) =>
              items.map((item) =>
                item.client_id === next.client_id ? next : item,
              ),
            );
            setEditing(null);
            toast(`${next.title} updated.`);
          }}
        />
      )}
    </section>
  );
}

function BatchEdit({ item, period, onClose, onSave }) {
  const [form, setForm] = useState(item);
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  return (
    <div
      className="batch-edit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batchEditTitle"
    >
      <button
        className="batch-edit-backdrop"
        type="button"
        aria-label="Close edit dialog"
        onClick={onClose}
      />
      <div className="batch-edit-dialog">
        <div className="batch-edit-header">
          <div>
            <h2 id="batchEditTitle">Adjust this title</h2>
          </div>
          <button
            className="icon-button light-icon-button"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <div className="batch-edit-preview">
            <Poster src={form.poster_url} alt="" />
            <div>
              <strong>{form.title || "Untitled"}</strong>
              <span>
                {form.media_type} ·{" "}
                {form.rating === "" ? "No rating" : `${form.rating}/10`}
              </span>
            </div>
          </div>
          <div className="form-grid">
            <Field full label="Title">
              <input
                required
                value={form.title}
                onChange={(e) => change("title", e.target.value)}
              />
            </Field>
            <Field label="Type">
              <select
                value={form.media_type}
                onChange={(e) => change("media_type", e.target.value)}
              >
                <option value="movie">Movie</option>
                <option value="series">Series</option>
              </select>
            </Field>
            <Field label="Runtime (minutes)">
              <input
                type="number"
                min="1"
                value={form.runtime_minutes}
                onChange={(e) => change("runtime_minutes", e.target.value)}
              />
            </Field>
            <Field label="Rating (0–10)">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.rating}
                onChange={(e) => change("rating", e.target.value)}
              />
            </Field>
            <Field label="Exact watched date (optional)">
              <input
                type="date"
                min={`${period}-01`}
                max={lastDate(period)}
                value={form.watched_at}
                onChange={(e) => change("watched_at", e.target.value)}
              />
            </Field>
            <Field full label="Poster URL">
              <input
                type="url"
                value={form.poster_url || ""}
                onChange={(e) => change("poster_url", e.target.value)}
              />
            </Field>
            <label className="checkbox-field is-full">
              <input
                type="checkbox"
                checked={form.watched_in_theater}
                onChange={(e) => change("watched_in_theater", e.target.checked)}
              />
              Watched in a theater
            </label>
            <Field full label="Review or impression">
              <textarea
                value={form.review}
                onChange={(e) => change("review", e.target.value)}
              />
            </Field>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Check aria-hidden="true" />
              Save changes
            </button>
            <button className="text-button" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
