import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { TmdbSearchPanel } from "../../movies/TmdbSearchPanel";
import { watchMarvelDb } from "../services/watch-marvel-db.service";
import { createMovieDraft, createWholeSeriesDraft } from "../utils/title-draft.util";
import { MarvelBulkQueue } from "./MarvelBulkQueue";
import { MarvelSeasonRangeForm } from "./MarvelSeasonRangeForm";

function clientId() {
  return crypto.randomUUID?.() || `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const actionsFor = (item) => item.media_type === "series"
  ? [{ id: "series", label: "Add Series" }, { id: "seasons", label: "Add Seasons" }]
  : [{ id: "movie", label: "Add to Batch" }];

export function MarvelBulkAddModal({ titles, refresh, toast, onClose }) {
  const [queue, setQueue] = useState([]);
  const [seasonDetails, setSeasonDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const identityKeys = useMemo(() => new Set([
    ...titles.map((title) => title.identityKey),
    ...queue.map((title) => title.identityKey),
  ].filter(Boolean)), [queue, titles]);

  function addDrafts(drafts) {
    const libraryKeys = new Set(titles.map((title) => title.identityKey));
    const queueKeys = new Set(queue.map((title) => title.identityKey));
    const accepted = [];
    for (const draft of drafts) {
      if (libraryKeys.has(draft.identityKey)) {
        toast(`${draft.title} is already in the library.`, "error");
      } else if (queueKeys.has(draft.identityKey)) {
        toast(`${draft.title} is already in this batch.`, "error");
      } else {
        accepted.push({ ...draft, clientId: clientId() });
        queueKeys.add(draft.identityKey);
      }
    }
    if (accepted.length) setQueue((current) => [...current, ...accepted]);
    return accepted.length;
  }

  async function select(details, action) {
    setError("");
    if (action === "seasons") {
      setSeasonDetails(details);
      return;
    }
    addDrafts([action === "movie" ? createMovieDraft(details) : createWholeSeriesDraft(details)]);
  }

  async function saveAll() {
    if (!queue.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const payloads = queue.map(({ clientId: _clientId, ...payload }) => payload);
      const saved = await watchMarvelDb.createTitles(payloads);
      await refresh();
      toast(`${saved.length} Marvel title${saved.length === 1 ? "" : "s"} added.`);
      onClose();
    } catch (nextError) {
      setError(nextError.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Bulk Add Marvel titles" onClose={onClose} busy={busy} className="wm-bulk-modal">
      <div className="wm-bulk-layout">
        <section>
          <h3>Search &amp; Results</h3>
          {seasonDetails ? (
            <MarvelSeasonRangeForm
              details={seasonDetails}
              existingIdentityKeys={identityKeys}
              actionLabel="Add seasons to batch"
              onCancel={() => setSeasonDetails(null)}
              onConfirm={(drafts) => {
                addDrafts(drafts);
                setSeasonDetails(null);
              }}
            />
          ) : <TmdbSearchPanel bulk getActions={actionsFor} onSelect={select} />}
        </section>
        <section>
          <div className="wm-bulk-queue-header"><div><h3>Batch Queue</h3><p>{queue.length} title{queue.length === 1 ? "" : "s"} ready to save</p></div>{queue.length > 0 && <button className="text-button" type="button" disabled={busy} onClick={() => setQueue([])}><Trash2 aria-hidden="true" /> Clear Batch</button>}</div>
          <MarvelBulkQueue queue={queue} titles={titles} disabled={busy} onRemove={(id) => setQueue((current) => current.filter((item) => item.clientId !== id))} onChange={(id, patch) => setQueue((current) => current.map((item) => item.clientId === id ? { ...item, ...patch } : item))} />
        </section>
      </div>
      {error && <p className="wm-field-error" role="alert">{error}</p>}
      <div className="wm-modal-actions wm-bulk-save-actions"><button className="primary-button" type="button" disabled={busy || !queue.length} onClick={saveAll}>{busy ? "Saving batchâ€¦" : "Save All Titles"}</button><button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}
