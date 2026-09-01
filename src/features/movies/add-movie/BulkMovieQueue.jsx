import { Info, PenLine, Plus, Upload, X } from "lucide-react";
import { Poster } from "../../../components/ui/Poster";
import { formatMonth } from "../../../utils/formatters";

export function BulkMovieQueue({ batch }) {
  const titleCount = batch.queue.length;

  return (
    <div className="add-panel bulk-queue-panel is-sticky">
      <div className="bulk-queue-heading">
        <h2>Review the batch</h2>
        <span className="bulk-count">
          {titleCount} {titleCount === 1 ? "title" : "titles"}
        </span>
      </div>
      <p className="bulk-period-summary">
        {batch.period
          ? `${formatMonth(batch.period)} · all items are saved as watched`
          : "Select a month to start building this batch."}
      </p>

      <div className="bulk-queue">
        {titleCount ? (
          batch.queue.map((item, index) => (
            <QueueItem
              key={item.client_id}
              item={item}
              index={index}
              saving={batch.saving}
              onEdit={batch.openEditor}
              onRemove={batch.removeMovie}
            />
          ))
        ) : (
          <EmptyQueue />
        )}
      </div>

      <DefaultDateNotice />
      <QueueActions batch={batch} />
    </div>
  );
}

function QueueItem({ item, index, saving, onEdit, onRemove }) {
  const rating = item.rating === "" ? "No rating" : `${item.rating}/10`;

  return (
    <article className="bulk-queue-item">
      <span className="bulk-queue-number">
        {String(index + 1).padStart(2, "0")}
      </span>
      <Poster src={item.poster_url} alt="" />
      <div className="bulk-queue-copy">
        <h3>{item.title}</h3>
        <p>
          {item.media_type} · {item.release_date?.slice(0, 4) || "TBA"}
        </p>
        <div className="bulk-item-facts">
          <span>{item.watched_at || "Exact day not set"}</span>
          <span>{rating}</span>
        </div>
      </div>
      <div className="bulk-item-actions">
        <button
          className="bulk-icon-button"
          type="button"
          disabled={saving}
          aria-label={`Edit ${item.title}`}
          onClick={() => onEdit(item)}
        >
          <PenLine aria-hidden="true" />
        </button>
        <button
          className="bulk-icon-button is-danger"
          type="button"
          disabled={saving}
          aria-label={`Remove ${item.title}`}
          onClick={() => onRemove(item.client_id)}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function EmptyQueue() {
  return (
    <div className="bulk-queue-empty">
      <Plus aria-hidden="true" />
      <p>
        Your selected titles will appear here before anything is saved.
      </p>
    </div>
  );
}

function DefaultDateNotice() {
  return (
    <div className="bulk-date-note">
      <Info aria-hidden="true" />
      <p>
        The current archive format needs a complete date. When an exact day is
        not set, the title is stored on the first day of the selected month.
      </p>
    </div>
  );
}

function QueueActions({ batch }) {
  const titleCount = batch.queue.length;
  const saveLabel = batch.saving
    ? "Saving batch…"
    : `Save ${titleCount || ""} ${titleCount === 1 ? "title" : "titles"}`;

  return (
    <div className="bulk-actions">
      <button
        className={`primary-button bulk-save-button ${batch.saving ? "is-loading" : ""}`}
        type="button"
        disabled={!batch.period || !titleCount || batch.saving}
        onClick={batch.saveBatch}
      >
        <Upload aria-hidden="true" />
        {saveLabel}
      </button>
      <button
        className="text-button"
        type="button"
        disabled={!titleCount || batch.saving}
        onClick={batch.clearQueue}
      >
        Clear list
      </button>
    </div>
  );
}
