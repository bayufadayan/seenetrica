import { DatabaseBackup, Download, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import { legacyMarvelDataService } from "../services/legacy-marvel-data.service";
import { LegacyMarvelActionModal } from "./LegacyMarvelActionModal";

export function shouldShowLegacyMarvelPanel(category, availability) {
  return category?.slug === "marvel" && availability?.available === true;
}

export function LegacyMarvelDataPanelView({ count, disabled, onMigrate, onSynchronize }) {
  return (
    <aside className="legacy-marvel-panel" aria-labelledby="legacy-marvel-panel-title">
      <DatabaseBackup aria-hidden="true" />
      <div>
        <h2 id="legacy-marvel-panel-title">Legacy Watch Marvel data found</h2>
        <p>
          This browser still has data from the previous Watch Marvel library. Choose
          whether to add it to the Spreadsheet or replace it with the current
          Spreadsheet data.
        </p>
        <small>{count} local title{count === 1 ? "" : "s"} found</small>
      </div>
      <div className="legacy-marvel-panel-actions">
        <button className="primary-button" type="button" disabled={disabled} onClick={onMigrate}>
          <Upload aria-hidden="true" /> Migrate to Spreadsheet
        </button>
        <button className="secondary-button" type="button" disabled={disabled} onClick={onSynchronize}>
          <Download aria-hidden="true" /> Synchronize from Spreadsheet
        </button>
      </div>
    </aside>
  );
}

export function LegacyMarvelDataPanel({ category, onCompleted }) {
  const [availability, setAvailability] = useState({ loading: true, available: false, count: 0 });
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();
  const isMarvel = category?.slug === "marvel";

  useEffect(() => {
    let active = true;
    if (!isMarvel) return () => { active = false; };
    legacyMarvelDataService.inspect()
      .then((result) => active && setAvailability({ loading: false, ...result }))
      .catch((nextError) => {
        if (active) {
          setAvailability({ loading: false, available: false, count: 0 });
          toast(nextError.message, "error");
        }
      });
    return () => { active = false; };
  }, [isMarvel, toast]);

  if (!shouldShowLegacyMarvelPanel(category, availability)) return null;

  async function complete(action) {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      let result;
      if (action === "migrate") {
        const pin = archiveService.askForPin();
        if (pin === null) return;
        if (!pin) throw new Error("A Seenetrica PIN is required to migrate.");
        result = await legacyMarvelDataService.migrate(pin, { onProgress: setProgress });
        toast(`${result.migrated} titles migrated; ${result.skipped} already existed.`);
      } else {
        result = await legacyMarvelDataService.synchronize({ onProgress: setProgress });
        toast(`Local Watch Marvel data replaced with ${result.replaced} Spreadsheet titles.`);
      }
      setAvailability({ loading: false, available: false, count: 0 });
      setMode(null);
      await onCompleted?.(result.state);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <LegacyMarvelDataPanelView
        count={availability.count}
        disabled={busy || availability.loading}
        onMigrate={() => { setError(null); setProgress(null); setMode("migrate"); }}
        onSynchronize={() => { setError(null); setProgress(null); setMode("synchronize"); }}
      />
      <LegacyMarvelActionModal
        mode={mode}
        count={availability.count}
        busy={busy}
        progress={progress}
        error={error}
        onCancel={() => !busy && setMode(null)}
        onConfirm={() => complete(mode)}
      />
    </>
  );
}
