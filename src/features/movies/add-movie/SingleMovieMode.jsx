import { PenLine } from "lucide-react";
import { TmdbSearchPanel } from "../TmdbSearchPanel";
import { MANUAL_MOVIE } from "./addMovie.utils";
import { SingleMovieForm } from "./SingleMovieForm";
import { useSingleMovieEntry } from "./useSingleMovieEntry";

export function SingleMovieMode({ preset, onProgress }) {
  const entry = useSingleMovieEntry({ preset, onProgress });

  return (
    <section className="add-layout page-shell">
      <div className="add-panel">
        <h2>Find on TMDB</h2>
        <TmdbSearchPanel onSelect={entry.selectMovie} />
        <div className="manual-divider">or</div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => entry.selectMovie(MANUAL_MOVIE)}
        >
          <PenLine aria-hidden="true" />
          Enter details manually
        </button>
      </div>

      <div className="add-panel is-sticky">
        <h2>Complete the entry</h2>
        {entry.selectedMovie ? (
          <SingleMovieForm
            form={entry.form}
            saving={entry.saving}
            preset={preset}
            drafts={entry.drafts}
            speech={entry.speech}
            onChange={entry.updateField}
            onSubmit={entry.submit}
            onCancel={entry.clearSelection}
          />
        ) : (
          <div className="empty-state">
            Choose a TMDB result or start a manual entry.
          </div>
        )}
      </div>
    </section>
  );
}
