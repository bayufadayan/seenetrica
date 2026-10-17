import { FormField } from "./FormField";
import { MovieReviewField } from "./MovieReviewField";

export function SingleMovieDetailsFields({ form, speech, onChange }) {
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

      <FormField full label="Original title">
        <input
          type="text"
          value={form.original_title}
          onChange={(event) => onChange("original_title", event.target.value)}
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

      <MovieReviewField form={form} speech={speech} onChange={onChange} />
    </div>
  );
}
