import { useState } from "react";
import { TmdbSearchPanel } from "../../movies/TmdbSearchPanel";
import { Modal } from "../../../components/ui/Modal";
import { Poster } from "../../../components/ui/Poster";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";

function fromDetails(details) {
  return {
    tmdbId: details.external_id,
    title: details.title,
    originalTitle: details.original_title || details.title,
    releaseDate: details.release_date,
    type: details.media_type,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    runtimeMinutes: details.runtime_minutes,
    isWatched: false,
    prerequisiteIds: [],
  };
}

export function MarvelTitleForm({ existing, titles, onSave, onClose }) {
  const [draft, setDraft] = useState(existing || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try { await onSave(draft); } catch (nextError) { setError(nextError.message); setBusy(false); }
  }
  const prerequisites = titles.filter((title) => title.id !== existing?.id);
  return (
    <Modal title={existing ? "Edit Marvel title" : "Add Marvel title"} onClose={onClose} busy={busy} className="wm-title-modal">
      {!existing && !draft && <TmdbSearchPanel onSelect={(details) => setDraft(fromDetails(details))} />}
      {draft && (
        <form className="wm-title-form" onSubmit={submit}>
          <div className="selected-preview"><Poster src={getTmdbImageUrl(draft.posterPath, "w342")} alt="" /><div><h3>{draft.title}</h3><p>{draft.type} · {draft.releaseDate?.slice(0, 4) || "TBA"}</p></div></div>
          <div className="form-grid">
            <label className="form-field"><span>Title</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required /></label>
            <label className="form-field"><span>Original title</span><input value={draft.originalTitle || ""} onChange={(e) => setDraft({ ...draft, originalTitle: e.target.value })} /></label>
            <label className="form-field"><span>Runtime (minutes)</span><input type="number" min="1" value={draft.runtimeMinutes || ""} onChange={(e) => setDraft({ ...draft, runtimeMinutes: Number(e.target.value) })} /></label>
            <label className="checkbox-field"><input type="checkbox" checked={draft.isWatched} onChange={(e) => setDraft({ ...draft, isWatched: e.target.checked })} /> Already watched</label>
          </div>
          {draft.type === "series" && <fieldset className="wm-prerequisites"><legend>Prerequisite titles</legend>{prerequisites.length ? prerequisites.map((title) => <label className="checkbox-field" key={title.id}><input type="checkbox" checked={draft.prerequisiteIds?.includes(title.id)} onChange={(e) => setDraft({ ...draft, prerequisiteIds: e.target.checked ? [...(draft.prerequisiteIds || []), title.id] : (draft.prerequisiteIds || []).filter((id) => id !== title.id) })} /> {title.title}</label>) : <p>Add another title before setting prerequisites.</p>}</fieldset>}
          {error && <p className="wm-field-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save title"}</button>{!existing && <button className="text-button" type="button" onClick={() => setDraft(null)}>Choose another</button>}</div>
        </form>
      )}
    </Modal>
  );
}
