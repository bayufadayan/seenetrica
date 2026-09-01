import { Check, X } from "lucide-react";
import { useState } from "react";
import { Poster } from "../../../components/ui/Poster";
import { FormField } from "./FormField";
import { getLastDateOfMonth } from "./addMovie.utils";

export function BatchEditDialog({ item, period, onClose, onSave }) {
  const [form, setForm] = useState(item);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <div
      className="batch-edit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batchEditTitle"
    >
      <button
        className="batch-edit-backdrop"
        type="button"
        aria-label="Close edit dialog"
        onClick={onClose}
      />
      <div className="batch-edit-dialog">
        <DialogHeader onClose={onClose} />
        <form onSubmit={submit}>
          <MoviePreview form={form} />
          <EditFields
            form={form}
            period={period}
            onChange={updateField}
          />
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Check aria-hidden="true" />
              Save changes
            </button>
            <button className="text-button" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DialogHeader({ onClose }) {
  return (
    <div className="batch-edit-header">
      <h2 id="batchEditTitle">Adjust this title</h2>
      <button
        className="icon-button light-icon-button"
        type="button"
        aria-label="Close"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

function MoviePreview({ form }) {
  return (
    <div className="batch-edit-preview">
      <Poster src={form.poster_url} alt="" />
      <div>
        <strong>{form.title || "Untitled"}</strong>
        <span>
          {form.media_type} · {form.rating === "" ? "No rating" : `${form.rating}/10`}
        </span>
      </div>
    </div>
  );
}

function EditFields({ form, period, onChange }) {
  return (
    <div className="form-grid">
      <FormField full label="Title">
        <input
          required
          value={form.title}
          onChange={(event) => onChange("title", event.target.value)}
        />
      </FormField>
      <FormField full label="Original title">
        <input
          value={form.original_title || ""}
          onChange={(event) => onChange("original_title", event.target.value)}
        />
      </FormField>
      <FormField label="Type">
        <select
          value={form.media_type}
          onChange={(event) => onChange("media_type", event.target.value)}
        >
          <option value="movie">Movie</option>
          <option value="series">Series</option>
        </select>
      </FormField>
      <FormField label="Runtime (minutes)">
        <input
          type="number"
          min="1"
          value={form.runtime_minutes}
          onChange={(event) => onChange("runtime_minutes", event.target.value)}
        />
      </FormField>
      <FormField label="Rating (0–10)">
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={form.rating}
          onChange={(event) => onChange("rating", event.target.value)}
        />
      </FormField>
      <FormField label="Exact watched date (optional)">
        <input
          type="date"
          min={`${period}-01`}
          max={getLastDateOfMonth(period)}
          value={form.watched_at}
          onChange={(event) => onChange("watched_at", event.target.value)}
        />
      </FormField>
      <FormField full label="Poster URL">
        <input
          type="url"
          value={form.poster_url || ""}
          onChange={(event) => onChange("poster_url", event.target.value)}
        />
      </FormField>
      <label className="checkbox-field is-full">
        <input
          type="checkbox"
          checked={form.watched_in_theater}
          onChange={(event) =>
            onChange("watched_in_theater", event.target.checked)
          }
        />
        Watched in a theater
      </label>
      <FormField full label="Review or impression">
        <textarea
          value={form.review}
          onChange={(event) => onChange("review", event.target.value)}
        />
      </FormField>
    </div>
  );
}
