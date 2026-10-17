import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Poster } from "../../../components/ui/Poster";
import { FALLBACK_POSTER } from "../../../utils/constants";
import { MemoryAttachmentFields } from "./MemoryAttachmentFields";
import { SingleMovieDetailsFields } from "./SingleMovieDetailsFields";

export function SingleMovieForm({
  form,
  saving,
  preset,
  drafts,
  speech,
  onChange,
  onSubmit,
  onCancel,
  sameTitleMatches = [],
  allowSameTitle = false,
  onAllowSameTitle,
}) {
  return (
    <form onSubmit={onSubmit}>
      <SelectedMoviePreview form={form} />
      <SingleMovieDetailsFields
        form={form}
        preset={preset}
        speech={speech}
        onChange={onChange}
      />
      {sameTitleMatches.length > 0 && (
        <div className="existing-movie-notice">
          <p className="existing-movie-heading">Same title found in the library</p>
          <p>These may be different releases. Check the existing records before creating another one:</p>
          {sameTitleMatches.map((movie) => (
            <p key={movie.id}><Link to={`/movies/${encodeURIComponent(movie.id)}`}>{movie.title} ({movie.release_date?.slice(0, 4) || "year unknown"})</Link></p>
          ))}
          <label className="checkbox-field">
            <input type="checkbox" checked={allowSameTitle} onChange={(event) => onAllowSameTitle(event.target.checked)} />
            This is a different title; create a new record
          </label>
        </div>
      )}
      <MemoryAttachmentFields drafts={drafts} saving={saving} />
      <FormActions saving={saving} onCancel={onCancel} blocked={sameTitleMatches.length > 0 && !allowSameTitle} />
    </form>
  );
}

function SelectedMoviePreview({ form }) {
  return (
    <div className="selected-preview">
      <Poster src={form.poster_url || FALLBACK_POSTER} alt="" />
      <div>
        <h3>{form.title || "Untitled"}</h3>
        <p>
          {form.media_type} · {form.release_date?.slice(0, 4) || "Release TBA"}
        </p>
      </div>
    </div>
  );
}

function FormActions({ saving, onCancel, blocked }) {
  return (
    <div className="form-actions">
      <button
        className={`primary-button ${saving ? "is-loading" : ""}`}
        type="submit"
        disabled={saving || blocked}
        aria-busy={saving}
      >
        <Plus aria-hidden="true" />
        <span className="button-spinner" hidden={!saving} />
        <span>{saving ? "Saving movie…" : "Add to Seenetrica"}</span>
      </button>
      <button
        className="text-button"
        type="button"
        disabled={saving}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
