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

export function CategorySyncStatusView({
  syncStatus,
  syncMeta,
  busy,
  onSync,
}) {
  const timestamp = syncMeta?.lastSyncedAt || syncMeta?.lastPulledAt;
  return (
    <div className={`category-sync-status is-${syncStatus}`}>
      <span aria-live="polite">{labels[syncStatus] || labels.saved}</span>
      {timestamp && <time dateTime={timestamp}>{new Date(timestamp).toLocaleString()}</time>}
      <button type="button" disabled={busy || syncStatus === "syncing"} onClick={onSync}>
        <RefreshCw aria-hidden="true" /> Sync
      </button>
    </div>
  );
}

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
      const result = await manualSync(pin);
      if (result.remaining) {
        toast(`${result.pushed} pushed, ${result.pulled} pulled, ${result.remaining} still saved locally.`);
      } else {
        toast(`${result.pushed} pushed and ${result.pulled} server records verified.`);
      }
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CategorySyncStatusView
      syncStatus={syncStatus}
      syncMeta={syncMeta}
      busy={busy}
      onSync={sync}
    />
  );
}
