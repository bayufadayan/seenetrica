import { Images, Play, X } from "lucide-react";
import { MEMORY_TYPES, VIDEO_TYPES } from "../../utils/constants";
import { formatBytes } from "../../utils/formatters";

export function MemoryDraftList({ manager, disabled = false }) {
  const { drafts, update, remove, maxFiles } = manager;
  if (!drafts.length)
    return (
      <div className="memory-drafts-empty">
        <Images aria-hidden="true" />
        <p>Add up to {maxFiles} photos or short videos from this experience.</p>
      </div>
    );
  return drafts.map((draft) => (
    <article
      className={`memory-draft-card is-${draft.status}`}
      key={draft.client_id}
    >
      <div className="memory-draft-preview">
        {VIDEO_TYPES.has(draft.file.type) ? (
          <>
            <video
              src={draft.preview_url}
              aria-label={`Preview of ${draft.file.name}`}
              muted
              playsInline
              preload="metadata"
            />
            <span className="memory-video-indicator" aria-hidden="true">
              <Play />
            </span>
          </>
        ) : (
          <img src={draft.preview_url} alt={`Preview of ${draft.file.name}`} />
        )}
        <span className="memory-draft-state">{draft.status_message}</span>
      </div>
      <div className="memory-draft-fields">
        <div className="memory-draft-heading">
          <div>
            <strong>{draft.file.name}</strong>
            <span>{formatBytes(draft.file.size)}</span>
          </div>
          <button
            className="memory-remove-button"
            type="button"
            disabled={disabled}
            aria-label={`Remove ${draft.file.name}`}
            onClick={() => remove(draft.client_id)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="memory-draft-grid">
          <label className="form-field">
            <span>Type</span>
            <select
              disabled={disabled}
              value={draft.memory_type}
              onChange={(e) =>
                update(draft.client_id, { memory_type: e.target.value })
              }
            >
              {MEMORY_TYPES.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Date (optional)</span>
            <input
              type="date"
              disabled={disabled}
              value={draft.memory_date}
              onChange={(e) =>
                update(draft.client_id, { memory_date: e.target.value })
              }
            />
          </label>
          <label className="form-field is-full">
            <span>Caption (optional)</span>
            <input
              type="text"
              maxLength="1000"
              disabled={disabled}
              value={draft.caption}
              placeholder="What does this memory hold?"
              onChange={(e) =>
                update(draft.client_id, { caption: e.target.value })
              }
            />
          </label>
        </div>
      </div>
    </article>
  ));
}
