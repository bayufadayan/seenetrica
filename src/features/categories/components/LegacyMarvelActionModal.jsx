import { LoaderCircle } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";

const progressLabels = {
  reading: "Reading legacy Watch Marvel data...",
  checking: "Checking the latest Spreadsheet data...",
  migrating: "Uploading missing titles...",
  verifying: "Verifying the refreshed Spreadsheet...",
  updating_cache: "Updating the local Marvel cache...",
  clearing_legacy: "Removing the migrated legacy records...",
};

export function LegacyMarvelActionModal({
  mode,
  count,
  busy,
  progress,
  error,
  onCancel,
  onConfirm,
}) {
  if (!mode) return null;
  const migrating = mode === "migrate";
  const completed = Number(progress?.completed) || 0;
  const total = Number(progress?.total) || count;

  return (
    <Modal
      title={migrating ? "Migrate Legacy Marvel Data?" : "Synchronize Marvel Data?"}
      className="legacy-marvel-action-modal"
      busy={busy}
      onClose={onCancel}
    >
      {migrating ? (
        <p>
          This browser contains {count} legacy Watch Marvel title{count === 1 ? "" : "s"}.
          Titles that are not already in the Spreadsheet will be added. Existing
          Spreadsheet records will not be overwritten or duplicated.
        </p>
      ) : (
        <p>
          Data Watch Marvel lama di browser ini akan dihapus dan diganti dengan data
          Marvel Films dari Spreadsheet. Proses ini tidak dapat dibatalkan.
        </p>
      )}

      {busy && (
        <div className="legacy-marvel-progress" aria-live="polite">
          <p><LoaderCircle aria-hidden="true" /> {progressLabels[progress?.stage] || "Working..."}</p>
          {migrating && progress?.stage === "migrating" && (
            <>
              <strong>Migrating {completed} of {total} titles</strong>
              <progress
                max={Math.max(total, 1)}
                value={Math.min(completed, total)}
                aria-label={`Migrating ${completed} of ${total} titles`}
              />
            </>
          )}
        </div>
      )}

      {error && <p className="legacy-migration-error" role="alert">{error.message}</p>}

      <div className="legacy-migration-actions">
        <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="button" disabled={busy} onClick={onConfirm}>
          {busy && <LoaderCircle aria-hidden="true" />}
          {migrating
            ? error ? "Retry Migration" : "Migrate to Spreadsheet"
            : error ? "Retry Synchronize" : "Replace Local Data"}
        </button>
      </div>
    </Modal>
  );
}
