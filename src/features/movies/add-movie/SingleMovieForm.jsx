import { Plus } from "lucide-react";
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
      <MemoryAttachmentFields drafts={drafts} saving={saving} />
      <FormActions saving={saving} onCancel={onCancel} />
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

function FormActions({ saving, onCancel }) {
  return (
    <div className="form-actions">
      <button
        className={`primary-button ${saving ? "is-loading" : ""}`}
        type="submit"
        disabled={saving}
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
