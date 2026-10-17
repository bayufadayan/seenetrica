import { Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Poster } from "../../../components/ui/Poster";
import { useArchive } from "../../../context/ArchiveContext";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import { today } from "../../../utils/formatters";
import { TmdbSearchPanel } from "../TmdbSearchPanel";
import { createMovieForm, createMoviePayload, getLastDateOfMonth } from "../add-movie/addMovie.utils";
import { findMoviesWithSameTitle } from "../movie-identity.util";
import "../add-movie/SingleMovieMode.css";
import { findMoviesByIdentity } from "../movie-identity.util";
import "./LogViewingSingleMode.css";

export function LogViewingSingleMode({ preset, requestedMovieId, onProgress }) {
  const { movies, loading, error, stale, refresh } = useArchive();
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState({
    watched_at: preset.watchedAt || (preset.period && !today().startsWith(preset.period) ? "" : today()),
    watched_in_theater: preset.inTheater,
  });

  const requestedMovie = movies.find((movie) => String(movie.id) === String(requestedMovieId));
  const selected = picked || (requestedMovie ? { kind: "existing", movie: requestedMovie } : null);
  const matchingMovies = search.trim()
    ? movies.filter((movie) => String(movie.title || "").toLowerCase().includes(search.trim().toLowerCase())).slice(0, 25)
    : [...movies].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 12);

  function chooseTmdb(details) {
    const movie = { ...details, external_source: "tmdb" };
    const matches = findMoviesByIdentity(movies, movie);
    if (matches.length === 1) setPicked({ kind: "existing", movie: matches[0] });
    else if (matches.length > 1) setPicked({ kind: "choose", movie, matches });
    else {
      const nameMatches = findMoviesWithSameTitle(movies, movie.title);
      setPicked(nameMatches.length ? { kind: "title-warning", movie, matches: nameMatches } : { kind: "tmdb", movie });
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!selected || ["choose", "title-warning"].includes(selected.kind) || saving) return;
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    setSaving(true);
    onProgress({ message: "Saving viewing history…", detail: "Checking the movie record before writing." });
    try {
      const payload = selected.kind === "existing"
        ? { movie_id: selected.movie.id, viewing }
        : {
            movie: createMoviePayload({
              ...createMovieForm(selected.movie, { status: "watched", inTheater: false, period: "", watchedAt: "" }),
              status: "watched",
            }, selected.movie),
            allow_same_title: Boolean(selected.allowSameTitle),
            viewing,
          };
      const result = await archiveService.writeAction("logViewing", payload, pin);
      await refresh();
      toast(result.created ? "Movie and viewing saved." : "Viewing added to the existing movie.");
      navigate(`/movies/${encodeURIComponent(result.movie.id)}`);
    } catch (nextError) {
      toast(nextError.message, "error");
      onProgress(null);
      setSaving(false);
    }
  }

  return (
    <section className="add-layout page-shell log-viewing-layout">
      <div className="add-panel">
        <h2>Find in your library</h2>
        <label className="archive-search log-viewing-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search saved movies</span>
          <input type="search" autoComplete="off" placeholder="Search saved movies" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {loading && <p className="collection-status">Loading library…</p>}
        {error && <p className="log-viewing-warning" role="alert">Library unavailable. Try again when your connection is restored.</p>}
        {stale && <p className="log-viewing-warning">Showing cached records. The server will verify the movie when you save.</p>}
        <div className="log-viewing-results">
          {matchingMovies.map((movie) => (
            <button className="log-viewing-result" type="button" key={movie.id} onClick={() => setPicked({ kind: "existing", movie })}>
              <Poster src={movie.poster_url} alt="" loading="lazy" />
              <span><strong>{movie.title}</strong><small>{movie.release_date?.slice(0, 4) || "Year unknown"} · {movie.media_type}</small></span>
            </button>
          ))}
          {!loading && !matchingMovies.length && <p className="collection-status">No saved titles match this search. Try TMDB below.</p>}
        </div>
        <div className="manual-divider">or</div>
        <h2>Find on TMDB</h2>
        <TmdbSearchPanel onSelect={chooseTmdb} />
        <p className="log-viewing-footnote">Can't find the title on TMDB? <Link to="/add-movie">Add it to your library</Link> first.</p>
      </div>
      <div className="add-panel is-sticky">
        <h2>Viewing details</h2>
        {!selected || selected.kind === "empty" ? (
          <div className="empty-state">Select a saved movie or choose a TMDB result to start.</div>
        ) : selected.kind === "choose" ? (
          <div className="existing-movie-notice">
            <p className="existing-movie-heading">Multiple matching movie records</p>
            <p>Select the correct record. No new movie will be created.</p>
            {selected.matches.map((movie) => (
              <button className="secondary-button" type="button" key={movie.id} onClick={() => setPicked({ kind: "existing", movie })}>
                {movie.title} · {movie.release_date?.slice(0, 4) || "Year unknown"} · {movie.id}
              </button>
            ))}
          </div>
        ) : selected.kind === "title-warning" ? (
          <div className="existing-movie-notice">
            <p className="existing-movie-heading">A title with the same name already exists</p>
            <p>Check the release before creating another record. A matching title does not always mean the same movie.</p>
            {selected.matches.map((movie) => (
              <button className="secondary-button" type="button" key={movie.id} onClick={() => setPicked({ kind: "existing", movie })}>
                Use {movie.title} · {movie.release_date?.slice(0, 4) || "Year unknown"}
              </button>
            ))}
            <button className="secondary-button" type="button" onClick={() => setPicked({ kind: "tmdb", movie: selected.movie, allowSameTitle: true })}>
              This is a different release — create a separate movie
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="log-viewing-selected">
              <Poster src={selected.movie.poster_url} alt="" />
              <div>
                <strong>{selected.movie.title}</strong>
                <p>{selected.movie.release_date?.slice(0, 4) || "Year unknown"} · {selected.movie.media_type}</p>
                <small>{selected.kind === "existing" ? "Existing library record · will be reused" : "New to your library · checked again when saved"}</small>
              </div>
            </div>
            <div className="form-grid log-viewing-fields">
              <label className="form-field"><span>Watched on</span>
                <input type="date" required value={viewing.watched_at} min={preset.period ? `${preset.period}-01` : undefined} max={getLastDateOfMonth(preset.period) || undefined} onChange={(event) => setViewing((state) => ({ ...state, watched_at: event.target.value }))} />
              </label>
              <label className="checkbox-field is-full"><input type="checkbox" checked={viewing.watched_in_theater} onChange={(event) => setViewing((state) => ({ ...state, watched_in_theater: event.target.checked }))} />Watched in a theater</label>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={saving || Boolean(error && !movies.length)}>{saving ? "Saving…" : "Save Viewing"}</button>
              <button className="text-button" type="button" disabled={saving} onClick={() => setPicked({ kind: "empty" })}>Change title</button>
            </div>
            <p className="log-viewing-footnote">This records a viewing without overwriting any existing rating or review.</p>
          </form>
        )}
      </div>
    </section>
  );
}
