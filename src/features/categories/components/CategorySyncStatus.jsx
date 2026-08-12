import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import { useCategories } from "../context/CategoriesProvider";

const labels = {
  synced: "Synced",
  syncing: "Syncing…",
  saved: "Saved locally",
  failed: "Sync failed",
};

export function CategorySyncStatus() {
  const { syncStatus, syncMeta, manualSync } = useCategories();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function sync() {
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required to sync.", "error");
      return;
    }
    setBusy(true);
    try {
      const state = await manualSync(pin);
      toast(state.outbox.length ? "Some changes are still saved locally." : "Categories synced.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`category-sync-status is-${syncStatus}`} role="status">
      <span>{labels[syncStatus] || labels.saved}</span>
      {syncMeta?.lastSyncedAt && <time dateTime={syncMeta.lastSyncedAt}>{new Date(syncMeta.lastSyncedAt).toLocaleString()}</time>}
      {(syncStatus !== "synced" || busy) && (
        <button type="button" disabled={busy || syncStatus === "syncing"} onClick={sync}>
          <RefreshCw aria-hidden="true" /> {syncStatus === "failed" ? "Retry" : "Sync"}
        </button>
      )}
    </div>
  );
}
