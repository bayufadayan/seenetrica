import { FormField } from "./FormField";
import { MovieReviewField } from "./MovieReviewField";
import { getLastDateOfMonth } from "./addMovie.utils";

export function SingleMovieDetailsFields({ form, preset, speech, onChange }) {
  return (
    <div className="form-grid">
      <FormField full label="Title">
        <input
          type="text"
          required
          value={form.title}
          onChange={(event) => onChange("title", event.target.value)}
        />
      </FormField>

      <FormField label="Type">
        <select
          required
          value={form.media_type}
          onChange={(event) => onChange("media_type", event.target.value)}
        >
          <option value="movie">Movie</option>
          <option value="series">Series</option>
        </select>
      </FormField>

      <FormField label="Release date">
        <input
          type="date"
          value={form.release_date}
          onChange={(event) => onChange("release_date", event.target.value)}
        />
      </FormField>

      <FormField label="Runtime (minutes)">
        <input
          type="number"
          min="1"
          value={form.runtime_minutes}
          onChange={(event) => onChange("runtime_minutes", event.target.value)}
        />
      </FormField>

      <FormField label="Status">
        <select
          required
          value={form.status}
          onChange={(event) => onChange("status", event.target.value)}
        >
          <option value="watchlist">Watchlist</option>
          <option value="plan">Planned</option>
          <option value="watched">Watched</option>
        </select>
      </FormField>

      <FormField full label="Poster URL">
        <input
          type="url"
          value={form.poster_url}
          onChange={(event) => onChange("poster_url", event.target.value)}
        />
      </FormField>

      <FormField label="Your rating (0–10)">
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={form.rating}
          onChange={(event) => onChange("rating", event.target.value)}
        />
      </FormField>

      {form.status === "watched" && (
        <WatchedFields form={form} preset={preset} onChange={onChange} />
      )}

      <MovieReviewField form={form} speech={speech} onChange={onChange} />
    </div>
  );
}

function WatchedFields({ form, preset, onChange }) {
  return (
    <>
      <FormField label="Watched on">
        <input
          type="date"
          required
          min={preset.period ? `${preset.period}-01` : undefined}
          max={getLastDateOfMonth(preset.period) || undefined}
          value={form.watched_at}
          onChange={(event) => onChange("watched_at", event.target.value)}
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
    </>
  );
}
