import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Heart, Plus, Search, Trash2, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useArchive } from "../context/ArchiveContext";
import { useToast } from "../context/ToastContext";
import { archiveService } from "../services/archive.service";
import { parseJson } from "../services/http";
import { Modal } from "../components/ui/Modal";
import { Poster } from "../components/ui/Poster";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./FavoritesPage.css";

export default function FavoritesPage({ kind }) {
  const actors = kind === "actor";
  const title = actors ? "Favorite Actors" : "Favorite Movies";
  useDocumentTitle(title);
  const { movies, favorites = [], loading, error, refresh } = useArchive();
  const toast = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragged, setDragged] = useState(null);
  const requestVersion = useRef(0);
  const movieMap = useMemo(() => new Map(movies.map((movie) => [String(movie.id), movie])), [movies]);
  const items = favorites.filter((item) => item.kind === kind).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const selectedIds = new Set(items.map((item) => String(item.item_id)));
  const candidates = actors ? results : movies.filter((movie) => movie.title.toLowerCase().includes(query.trim().toLowerCase()));

  async function mutate(data) {
    if (busy) return false;
    const pin = archiveService.askForPin();
    if (pin === null) return false;
    if (!pin) { toast("PIN is required.", "error"); return false; }
    setBusy(true);
    try {
      await archiveService.writeAction("updateFavorites", { kind, ...data }, pin);
      await refresh();
      toast("Favorites saved.");
      return true;
    } catch (nextError) { toast(nextError.message, "error"); return false; }
    finally { setBusy(false); }
  }

  async function searchActors(event, nextPage = 1) {
    event?.preventDefault();
    const term = nextPage === 1 ? query.trim() : searchedQuery;
    if (term.length < 2) return;
    const version = ++requestVersion.current;
    setSearching(true); setSearchError("");
    try {
      const params = new URLSearchParams({ q: term, type: "person", page: String(nextPage) });
      const payload = await parseJson(await fetch(`/api/tmdb/search?${params}`));
      if (version !== requestVersion.current) return;
      setResults(payload.results || []); setPage(nextPage); setTotalPages(payload.total_pages || 1); setSearchedQuery(term);
    } catch (nextError) { if (version === requestVersion.current) setSearchError(nextError.message); }
    finally { if (version === requestVersion.current) setSearching(false); }
  }

  function move(fromId, toId) {
    if (busy || !fromId || fromId === toId) return;
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    mutate({ operation: "reorder", ids });
  }

  function openPicker() {
    setQuery(""); setResults([]); setPage(0); setSearchError(""); setPickerOpen(true);
  }

  return <main className="favorites-page page-shell">
    <header className="favorites-heading">
      <div><p className="eyebrow">YOUR PERSONAL PICKS</p><h1>Favorite <em>{actors ? "actors." : "movies."}</em></h1><p className="favorites-caption">{items.length} favorites · Your order, your favorites.</p></div>
      <button className="primary-button" type="button" disabled={loading || !!error || busy} onClick={openPicker}><Plus aria-hidden="true" /> Add {actors ? "actor" : "movie"}</button>
    </header>
    {loading ? <LoadingState>Loading favorites…</LoadingState> : error ? <ErrorState>Favorites could not be loaded.</ErrorState> : items.length ? <>
      <p className="favorites-order-hint">Drag to reorder, or use the arrow buttons.</p>
      <ol className="favorites-list" aria-label={title} aria-busy={busy}>
        {items.map((item, index) => {
          const movie = actors ? null : movieMap.get(String(item.item_id));
          const name = movie?.title || item.name;
          const image = movie?.poster_url || item.image_url;
          const href = actors ? `https://www.themoviedb.org/person/${item.item_id}` : `/movies/${encodeURIComponent(item.item_id)}`;
          return <li key={item.id} className={`favorite-row ${dragged === item.id ? "is-dragged" : ""}`} draggable={!busy} onDragStart={(event) => { setDragged(item.id); event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { if (!busy) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); move(dragged, item.id); setDragged(null); }} onDragEnd={() => setDragged(null)}>
            <span className="favorite-rank">{String(index + 1).padStart(2, "0")}</span>
            <span className={`favorite-image ${actors ? "is-actor" : ""}`}>{image ? <Poster key={image} src={image} alt={name} loading="lazy" /> : <UserRound aria-label="No photo" />}</span>
            <div className="favorite-copy">{actors ? <a href={href} target="_blank" rel="noreferrer">{name}<ExternalLink aria-hidden="true" /></a> : <Link to={href}>{name}</Link>}<span>{actors ? "Actor" : `${movie?.release_date?.slice(0, 4) || "Year unknown"} · ${movie?.media_type || "Movie"}`}</span></div>
            <div className="favorite-controls"><button type="button" disabled={busy || index === 0} onClick={() => move(item.id, items[index - 1].id)} aria-label={`Move ${name} up`}><ArrowUp /></button><button type="button" disabled={busy || index === items.length - 1} onClick={() => move(item.id, items[index + 1].id)} aria-label={`Move ${name} down`}><ArrowDown /></button><button type="button" disabled={busy} onClick={() => mutate({ operation: "remove", id: item.id })} aria-label={`Remove ${name} from favorites`}><Trash2 /></button><GripVertical className="favorite-grip" aria-hidden="true" /></div>
          </li>;
        })}
      </ol>
    </> : <div className="favorites-empty"><Heart aria-hidden="true" /><EmptyState>Your favorites start here.</EmptyState><button className="text-button" type="button" onClick={openPicker}>Choose your first {actors ? "actor" : "movie"}</button></div>}
    {pickerOpen && <Modal title={actors ? "Find an actor" : "Choose a movie"} busy={busy} onClose={() => { requestVersion.current++; setSearching(false); setPickerOpen(false); }} className="favorites-picker">
      <form className="favorites-search" onSubmit={actors ? searchActors : (event) => event.preventDefault()}><label className="archive-search"><Search aria-hidden="true" /><input type="search" aria-label={actors ? "Actor name" : "Movie title"} placeholder={actors ? "Search TMDB by actor name" : "Search All Movies"} value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} /></label>{actors && <button className="primary-button" disabled={searching || query.trim().length < 2} type="submit">{searching ? "Searching…" : "Search"}</button>}</form>
      {searchError && <p role="alert" className="error-state">{searchError}</p>}
      <div className="favorites-picker-results" aria-live="polite">{candidates.map((candidate) => {
        const id = String(candidate.id), selected = selectedIds.has(id);
        return <div className="favorites-candidate" key={id}><span className="favorites-candidate-photo">{(actors ? candidate.image_url : candidate.poster_url) ? <Poster src={actors ? candidate.image_url : candidate.poster_url} alt="" loading="lazy" /> : <UserRound aria-hidden="true" />}</span><div><strong>{actors ? candidate.name : candidate.title}</strong><small>{actors ? candidate.known_for : `${candidate.release_date?.slice(0, 4) || "Year unknown"} · ${candidate.media_type}`}</small></div><button className="secondary-button" type="button" disabled={busy || selected || searching} onClick={() => mutate({ operation: "add", item_id: id, name: actors ? candidate.name : candidate.title, image_url: actors ? candidate.image_url : candidate.poster_url })}>{selected ? "Added" : "Add"}</button></div>;
      })}{!candidates.length && (!actors || page > 0) && !searching && <EmptyState>No matches found.</EmptyState>}</div>
      {actors && page > 0 && <div className="form-actions"><button className="text-button" type="button" disabled={searching || page <= 1} onClick={() => searchActors(null, page - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="text-button" type="button" disabled={searching || page >= totalPages} onClick={() => searchActors(null, page + 1)}>Next</button></div>}
      {actors && <p className="favorites-caption">Actor names and photos from TMDB.</p>}
    </Modal>}
  </main>;
}
