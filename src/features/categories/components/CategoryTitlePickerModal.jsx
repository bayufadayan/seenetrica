import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Poster } from "../../../components/ui/Poster";
import { useArchive } from "../../../context/ArchiveContext";
import { archiveService } from "../../../services/archive.service";
import { tmdbService } from "../../../services/tmdb.service";
import { CategorySeasonRangeForm } from "./CategorySeasonRangeForm";

function localMovieTitle(movie) {
  return String(movie.title || movie.base_title || "").trim();
}

function categoryTitleFromMovie(movie, sortOrder) {
  const title = localMovieTitle(movie);
  return {
    movieId: movie.id,
    tmdbId: movie.external_source === "tmdb" ? movie.external_id : null,
    title,
    baseTitle: movie.base_title || title,
    originalTitle: movie.original_title || title,
    releaseDate: movie.release_date || null,
    type: movie.media_type === "series" ? "series" : "movie",
    seasonNumber: Number(movie.season_number) || null,
    seasonTmdbId: Number(movie.season_tmdb_id) || null,
    runtimeMinutes: Number(movie.runtime_minutes) || null,
    posterPath: movie.poster_path || movie.poster_url || null,
    backdropPath: movie.backdrop_path || null,
    identityKey: `archive:${movie.id}`,
    isWatched: movie.status === "watched",
    sortOrder,
    note: "",
    prerequisiteIds: [],
  };
}

function movieRecordFromTmdb(details) {
  return {
    external_source: "tmdb",
    external_id: details.external_id,
    title: details.title,
    base_title: details.title,
    original_title: details.original_title || details.title,
    poster_url: details.poster_url || (details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null),
    poster_path: details.poster_path || null,
    backdrop_path: details.backdrop_path || null,
    release_date: details.release_date || null,
    media_type: details.media_type,
    runtime_minutes: details.runtime_minutes || null,
    season_number: null,
    season_tmdb_id: null,
    identity_key: `tmdb:${details.media_type}:${details.external_id}`,
    status: "unlisted",
    rating: null,
    review: null,
  };
}

function movieRecordFromSeason(details, draft) {
  return {
    ...movieRecordFromTmdb(details),
    title: draft.title,
    base_title: draft.baseTitle,
    original_title: draft.originalTitle || details.original_title || details.title,
    poster_url: draft.posterPath ? `https://image.tmdb.org/t/p/w500${draft.posterPath}` : null,
    poster_path: draft.posterPath || null,
    release_date: draft.releaseDate || null,
    season_number: draft.seasonNumber,
    season_tmdb_id: draft.seasonTmdbId,
    identity_key: draft.identityKey,
  };
}

export function CategoryTitlePickerModal({ titles, categoryName, sortOrder = 0, onSave, onClose }) {
  const { movies, loading: archiveLoading, refresh } = useArchive();
  const [query, setQuery] = useState("");
  const [searchTmdb, setSearchTmdb] = useState(false);
  const [tmdbResults, setTmdbResults] = useState([]);
  const [tmdbStatus, setTmdbStatus] = useState("");
  const [seasonDetails, setSeasonDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const searchRequest = useRef(0);
  const existingKeys = useMemo(() => new Set(titles.map((title) => title.identityKey).filter(Boolean)), [titles]);
  const existingMovieIds = useMemo(() => new Set(titles.map((title) => String(title.movieId || "")).filter(Boolean)), [titles]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length < 2) return [];
    return movies.filter((movie) => `${movie.title || ""} ${movie.original_title || ""} ${movie.base_title || ""}`.toLocaleLowerCase().includes(normalized)).slice(0, 30);
  }, [movies, query]);

  useEffect(() => {
    const normalized = query.trim();
    if (!searchTmdb || archiveLoading || normalized.length < 2) {
      setTmdbResults([]);
      setTmdbStatus("");
      return undefined;
    }
    const requestId = ++searchRequest.current;
    setTmdbStatus("Searching TMDB automatically…");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await tmdbService.search(normalized, 1);
        if (requestId !== searchRequest.current) return;
        setTmdbResults(response.results);
        setTmdbStatus(response.results.length ? `${response.results.length} results from TMDB` : "No results found on TMDB.");
      } catch (nextError) {
        if (requestId !== searchRequest.current) return;
        setTmdbStatus(nextError.message || "TMDB search failed.");
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [archiveLoading, query, searchTmdb]);

  async function save(payload) {
    setBusy(true);
    setError("");
    try {
      await onSave(payload);
      onClose();
    } catch (nextError) {
      setError(nextError.message || "The title could not be added.");
      setBusy(false);
    }
  }

  async function getArchiveMovie(details) {
    const existing = movies.find((movie) => movie.external_source === "tmdb"
      && String(movie.external_id) === String(details.external_id)
      && movie.media_type === details.media_type
      && Number(movie.season_number || 0) === 0);
    if (existing) return existing;
    const pin = archiveService.askForPin();
    if (pin === null) return null;
    if (!pin) throw new Error("PIN is required to register a TMDB title in All Movies.");
    const result = await archiveService.writeAction("createMovie", { movie: movieRecordFromTmdb(details) }, pin);
    await refresh();
    return result.movie;
  }

  async function chooseTmdb(result, action = "title") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const details = await tmdbService.getDetails(result.external_id, result.media_type);
      if (action === "seasons") {
        setSeasonDetails(details);
        setBusy(false);
        return;
      }
      const movie = await getArchiveMovie(details);
      if (!movie) {
        setBusy(false);
        return;
      }
      await onSave(categoryTitleFromMovie(movie, sortOrder));
      onClose();
    } catch (nextError) {
      setError(nextError.message || "The TMDB title could not be added.");
      setBusy(false);
    }
  }

  async function saveSeasons(drafts) {
    setBusy(true);
    setError("");
    try {
      const details = seasonDetails;
      const seasonMovies = [];
      const missingSeasons = drafts.filter((draft) => !movies.some((movie) => (
        movie.external_source === "tmdb"
        && String(movie.external_id) === String(details.external_id)
        && movie.media_type === details.media_type
        && Number(movie.season_number || 0) === Number(draft.seasonNumber)
      )));
      let pin = null;
      if (missingSeasons.length) {
        pin = archiveService.askForPin();
        if (pin === null) {
          setBusy(false);
          return;
        }
        if (!pin) throw new Error("PIN is required to register seasons in All Movies.");
      }

      const records = [];
      for (const [index, draft] of drafts.entries()) {
        let movie = [...movies, ...seasonMovies].find((record) => (
          record.external_source === "tmdb"
          && String(record.external_id) === String(details.external_id)
          && record.media_type === details.media_type
          && Number(record.season_number || 0) === Number(draft.seasonNumber)
        ));
        if (!movie) {
          const response = await archiveService.writeAction(
            "createMovie",
            { movie: movieRecordFromSeason(details, draft), allow_same_title: true },
            pin,
          );
          movie = response.movie;
          seasonMovies.push(movie);
        }
        records.push({
          ...draft,
          movieId: movie.id,
          sortOrder: sortOrder + index,
          isWatched: movie.status === "watched",
        });
      }
      if (seasonMovies.length) await refresh();
      await onSave(records);
      onClose();
    } catch (nextError) {
      setError(nextError.message || "The seasons could not be added.");
      setBusy(false);
    }
  }

  return (
    <Modal title={`Add to ${categoryName}`} onClose={onClose} busy={busy} className="category-title-picker-modal">
      {seasonDetails ? (
        <>
          <CategorySeasonRangeForm details={seasonDetails} existingIdentityKeys={existingKeys} busy={busy} onCancel={() => setSeasonDetails(null)} onConfirm={saveSeasons} actionLabel="Add seasons" />
          {error && <p className="wm-field-error" role="alert">{error}</p>}
        </>
      ) : (
        <>
          <label className="form-field category-title-search"><span>Search your All Movies database</span><input type="search" autoFocus autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a movie or series title" /></label>
          <div className="category-title-search-results" aria-live="polite">
            {archiveLoading ? <p className="wm-empty-row">Loading your All Movies database…</p> : query.trim().length < 2 ? <p className="wm-empty-row">Type at least 2 characters to search your database.</p> : matches.length ? matches.map((movie) => {
              const alreadyAdded = existingMovieIds.has(String(movie.id));
              return <button className="category-title-search-result" key={movie.id} type="button" disabled={busy || alreadyAdded} onClick={() => save(categoryTitleFromMovie(movie, sortOrder))}><Poster src={movie.poster_url} alt="" /><span><strong>{movie.title}</strong><small>{movie.media_type === "series" ? "Series" : "Movie"} · {movie.release_date?.slice(0, 4) || "Year unknown"} · {movie.status || "Unlisted"}</small></span><span>{alreadyAdded ? "Already added" : "Add"}</span></button>;
            }) : null}
          </div>
          {!archiveLoading && query.trim().length >= 2 && !searchTmdb && <div className="category-title-no-local"><span>{matches.length ? "Found in your database. Want to look on TMDB too?" : "No title in your database."}</span><button className="secondary-button" type="button" onClick={() => setSearchTmdb(true)}>Search TMDB</button></div>}
          {!archiveLoading && query.trim().length >= 2 && searchTmdb && <><p className="collection-status" role="status">{tmdbStatus || "Waiting for search…"}</p><div className="category-title-search-results">{tmdbResults.map((result) => <article className="category-title-search-result category-title-tmdb-result" key={`${result.media_type}:${result.external_id}`}><Poster src={result.poster_url} alt="" /><span><strong>{result.title}</strong><small>{result.media_type === "series" ? "Series" : "Movie"} · {result.release_date?.slice(0, 4) || "Year unknown"}</small></span><span className="category-title-result-actions">{result.media_type === "series" && <button type="button" disabled={busy} onClick={() => chooseTmdb(result, "seasons")}>Add seasons</button>}<button type="button" disabled={busy} onClick={() => chooseTmdb(result)}>{busy ? "Adding…" : "Add"}</button></span></article>)}</div></>}
          {error && <p className="wm-field-error" role="alert">{error}</p>}
        </>
      )}
      <div className="form-actions"><button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}
