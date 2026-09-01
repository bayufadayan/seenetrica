import { useBodyLock } from "../../../hooks/useBodyLock";
import { TmdbSearchPanel } from "../TmdbSearchPanel";
import { BatchEditDialog } from "./BatchEditDialog";
import { BulkMovieQueue } from "./BulkMovieQueue";
import { FormField } from "./FormField";
import { useBulkMovieBatch } from "./useBulkMovieBatch";

export function BulkMovieMode({ onProgress }) {
  const batch = useBulkMovieBatch({ onProgress });
  useBodyLock(Boolean(batch.editingItem));

  return (
    <section className="bulk-add-shell page-shell">
      <PeriodSelector batch={batch} />

      <div className="bulk-workspace">
        <div className="add-panel">
          <h2>Find titles</h2>
          <TmdbSearchPanel
            bulk
            disabled={!batch.period || batch.saving}
            onSelect={batch.addMovie}
          />
        </div>

        <BulkMovieQueue batch={batch} />
      </div>

      {batch.editingItem && (
        <BatchEditDialog
          item={batch.editingItem}
          period={batch.period}
          onClose={batch.closeEditor}
          onSave={batch.updateMovie}
        />
      )}
    </section>
  );
}

function PeriodSelector({ batch }) {
  return (
    <div className="bulk-period-card">
      <div>
        <h2>Choose the viewing month</h2>
        <p>
          Every title in this batch will be saved as watched during this month.
          You can still set an exact day from the pencil button.
        </p>
      </div>
      <FormField label="Month and year">
        <input
          type="month"
          required
          disabled={batch.saving}
          value={batch.period}
          onChange={(event) => batch.changePeriod(event.target.value)}
        />
      </FormField>
    </div>
  );
}
