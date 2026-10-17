import { PenLine } from "lucide-react";
import { Link } from "react-router-dom";
import { TmdbSearchPanel } from "../TmdbSearchPanel";
import { MANUAL_MOVIE } from "./addMovie.utils";
import { SingleMovieForm } from "./SingleMovieForm";
import { useSingleMovieEntry } from "./useSingleMovieEntry";
import "./SingleMovieMode.css";

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
        {entry.selectedMovie && entry.existingMatches.length ? (
          <div className="existing-movie-notice">
            <p className="existing-movie-heading">Already in your library</p>
            <p>This title already has a movie record. Use it instead of creating a duplicate.</p>
            {entry.existingMatches.map((movie) => (
              <div className="existing-movie-actions" key={movie.id}>
                <Link className="secondary-button" to={`/movies/${encodeURIComponent(movie.id)}`}>Open {movie.title}</Link>
                <Link className="primary-button" to={`/log-viewing?movie_id=${encodeURIComponent(movie.id)}`}>Log a Viewing</Link>
              </div>
            ))}
          </div>
        ) : entry.selectedMovie ? (
          <SingleMovieForm
            form={entry.form}
            saving={entry.saving}
            preset={preset}
            drafts={entry.drafts}
            speech={entry.speech}
            onChange={entry.updateField}
            onSubmit={entry.submit}
            onCancel={entry.clearSelection}
            sameTitleMatches={entry.sameTitleMatches}
            allowSameTitle={entry.allowSameTitle}
            onAllowSameTitle={entry.setAllowSameTitle}
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
