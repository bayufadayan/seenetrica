import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Poster } from "../../../components/ui/Poster";
import { MarvelTitleForm } from "./MarvelTitleForm";
import { watchMarvelDb } from "../services/watch-marvel-db.service";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";

export function MarvelLibraryManager({ titles, refresh, toast }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [watched, setWatched] = useState("all");
  const [editing, setEditing] = useState(undefined);
  const filtered = titles.filter((title) => title.title.toLowerCase().includes(query.toLowerCase()) && (type === "all" || title.type === type) && (watched === "all" || title.isWatched === (watched === "watched")));
  async function save(payload) {
    if (editing) await watchMarvelDb.updateTitle(editing.id, payload); else await watchMarvelDb.createTitle(payload);
    await refresh(); setEditing(undefined); toast("Marvel library updated.");
  }
  async function remove(title) {
    if (!window.confirm(`Delete ${title.title} from the Marvel library?`)) return;
    try { await watchMarvelDb.deleteTitle(title.id); await refresh(); toast("Title removed."); } catch (error) { toast(error.message, "error"); }
  }
  return (
    <section className="wm-settings-section" id="library"><header><h2>Marvel Library</h2><button className="primary-button" type="button" onClick={() => setEditing(null)}><Plus aria-hidden="true" /> Add title</button></header>
      <div className="wm-library-tools"><label className="archive-search"><Search aria-hidden="true" /><input type="search" aria-label="Search Marvel library" placeholder="Search local library" value={query} onChange={(e) => setQuery(e.target.value)} /></label><label className="form-field"><span>Type</span><select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option><option value="movie">Movies</option><option value="series">Series</option></select></label><label className="form-field"><span>Status</span><select value={watched} onChange={(e) => setWatched(e.target.value)}><option value="all">All status</option><option value="unwatched">Unwatched</option><option value="watched">Watched</option></select></label></div>
      <div className="wm-library-grid">{filtered.map((title) => <article className="wm-library-card" key={title.id}><Poster src={getTmdbImageUrl(title.posterPath, "w342")} alt="" /><div><h3>{title.title}</h3><p>{title.type} · {title.releaseDate?.slice(0, 4) || "TBA"} · {title.runtimeMinutes ? `${title.runtimeMinutes} min` : "Runtime unknown"}</p><label className="checkbox-field"><input type="checkbox" checked={title.isWatched} onChange={async (e) => { await watchMarvelDb.setTitleWatched(title.id, e.target.checked); await refresh(); }} /> Watched</label></div><div className="wm-card-actions"><button type="button" aria-label={`Edit ${title.title}`} onClick={() => setEditing(title)}><Pencil /></button><button type="button" aria-label={`Delete ${title.title}`} onClick={() => remove(title)}><Trash2 /></button></div></article>)}{!filtered.length && <p className="wm-empty-row">No titles match these filters.</p>}</div>
      {editing !== undefined && <MarvelTitleForm existing={editing} titles={titles} onSave={save} onClose={() => setEditing(undefined)} />}
    </section>
  );
}
