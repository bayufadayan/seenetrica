import { useMemo, useState } from "react";
import { TmdbSearchPanel } from "../../movies/TmdbSearchPanel";
import { Modal } from "../../../components/ui/Modal";
import { Poster } from "../../../components/ui/Poster";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";
import { createMovieDraft, createWholeSeriesDraft } from "../utils/title-draft.util";
import { MarvelPrerequisiteSelector } from "./MarvelPrerequisiteSelector";
import { MarvelSeasonRangeForm } from "./MarvelSeasonRangeForm";

const actionsFor = (item) => item.media_type === "series"
  ? [{ id: "series", label: "Add Series" }, { id: "seasons", label: "Add Seasons" }]
  : [{ id: "movie", label: "Add Movie" }];

export function MarvelTitleForm({ existing, titles, onSave, onClose }) {
  const [draft, setDraft] = useState(existing || null);
  const [seasonDetails, setSeasonDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const identityKeys = useMemo(() => new Set(titles.map((title) => title.identityKey).filter(Boolean)), [titles]);

  async function savePayload(payload) {
    setBusy(true);
    setError("");
    try {
      await onSave(payload);
    } catch (nextError) {
      setError(nextError.message);
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (draft) await savePayload(draft);
  }

  function select(details, action) {
    setError("");
    if (action === "seasons") {
      setSeasonDetails(details);
      return;
    }
    setDraft(action === "movie" ? createMovieDraft(details) : createWholeSeriesDraft(details));
  }

  return (
    <Modal title={existing ? "Edit Marvel title" : "Add Marvel title"} onClose={onClose} busy={busy} className="wm-title-modal">
      {!existing && !draft && !seasonDetails && <TmdbSearchPanel getActions={actionsFor} onSelect={select} />}
      {!existing && seasonDetails && (
        <MarvelSeasonRangeForm
          details={seasonDetails}
          existingIdentityKeys={identityKeys}
          busy={busy}
          onCancel={() => setSeasonDetails(null)}
          onConfirm={savePayload}
        />
      )}
      {draft && (
        <form className="wm-title-form" onSubmit={submit}>
          <div className="selected-preview"><Poster src={getTmdbImageUrl(draft.posterPath, "w342")} alt="" /><div><h3>{draft.title}</h3><p>{draft.type === "movie" ? "Movie" : "Series"}{draft.seasonNumber ? ` · Season ${draft.seasonNumber}` : ""} · {draft.releaseDate?.slice(0, 4) || "TBA"}</p></div></div>
          {draft.seasonNumber && <div className="wm-season-identity"><span>Base series</span><strong>{draft.baseTitle}</strong><span>Season</span><strong>{draft.seasonNumber}</strong></div>}
          <div className="form-grid">
            <label className="form-field"><span>Title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
            <label className="form-field"><span>Original title</span><input value={draft.originalTitle || ""} onChange={(event) => setDraft({ ...draft, originalTitle: event.target.value })} /></label>
            <label className="form-field"><span>Runtime (minutes)</span><input type="number" min="1" value={draft.runtimeMinutes || ""} onChange={(event) => setDraft({ ...draft, runtimeMinutes: Number(event.target.value) })} /></label>
            <label className="checkbox-field"><input type="checkbox" checked={draft.isWatched} onChange={(event) => setDraft({ ...draft, isWatched: event.target.checked })} /> Already watched</label>
          </div>
          <MarvelPrerequisiteSelector titles={titles} value={draft.prerequisiteIds || []} excludeId={existing?.id} disabled={busy} onChange={(prerequisiteIds) => setDraft({ ...draft, prerequisiteIds })} />
          {error && <p className="wm-field-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? "Savingâ€¦" : "Save title"}</button>{!existing && <button className="text-button" type="button" disabled={busy} onClick={() => setDraft(null)}>Choose another</button>}</div>
        </form>
      )}
      {!draft && error && <p className="wm-field-error" role="alert">{error}</p>}
    </Modal>
  );
}
