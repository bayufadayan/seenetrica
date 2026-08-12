import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { TmdbSearchPanel } from "../../movies/TmdbSearchPanel";
import { createMovieDraft, createWholeSeriesDraft } from "../utils/title-draft.util";
import { CategorySeasonRangeForm } from "./CategorySeasonRangeForm";

const actionsFor = (item) => item.media_type === "series"
  ? [{ id: "series", label: "Add Series" }, { id: "seasons", label: "Add Seasons" }]
  : [{ id: "movie", label: "Add to Batch" }];

export function CategoryBulkAddModal({ titles, categoryName, onSave, onClose }) {
  const [queue, setQueue] = useState([]);
  const [seasonDetails, setSeasonDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const identityKeys = useMemo(() => new Set([...titles, ...queue].map((title) => title.identityKey).filter(Boolean)), [queue, titles]);

  function addDrafts(drafts) {
    const known = new Set(identityKeys);
    const accepted = drafts.filter((draft) => {
      if (known.has(draft.identityKey)) return false;
      known.add(draft.identityKey);
      return true;
    }).map((draft) => ({ ...draft, clientId: crypto.randomUUID() }));
    setQueue((current) => [...current, ...accepted]);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave(queue.map(({ clientId: _clientId, ...record }) => record));
      onClose();
    } catch (nextError) {
      setError(nextError.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Bulk add ${categoryName} titles`} onClose={onClose} busy={busy} className="wm-bulk-modal">
      {seasonDetails ? (
        <CategorySeasonRangeForm details={seasonDetails} existingIdentityKeys={identityKeys} onCancel={() => setSeasonDetails(null)} onConfirm={(drafts) => { addDrafts(drafts); setSeasonDetails(null); }} />
      ) : <TmdbSearchPanel bulk getActions={actionsFor} onSelect={(details, action) => { if (action === "seasons") setSeasonDetails(details); else addDrafts([action === "movie" ? createMovieDraft(details) : createWholeSeriesDraft(details)]); }} />}
      <div className="category-bulk-list">
        {queue.map((title) => <div key={title.clientId}><span>{title.title}</span><button type="button" aria-label={`Remove ${title.title}`} onClick={() => setQueue((current) => current.filter((item) => item.clientId !== title.clientId))}><Trash2 aria-hidden="true" /></button></div>)}
        {!queue.length && <p className="wm-empty-row">Search TMDB and add titles to build this batch.</p>}
      </div>
      {error && <p className="wm-field-error" role="alert">{error}</p>}
      <div className="wm-modal-actions"><button className="primary-button" type="button" disabled={busy || !queue.length} onClick={save}>{busy ? "Saving…" : "Save all titles"}</button><button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}
