import { Layers3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Poster } from "../../../components/ui/Poster";
import { MarvelBulkAddModal } from "./MarvelBulkAddModal";
import { MarvelTitleForm } from "./MarvelTitleForm";
import { watchMarvelDb } from "../services/watch-marvel-db.service";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";

function titleMeta(title) {
  return [
    title.type === "movie" ? "Movie" : "Series",
    title.seasonNumber ? `Season ${title.seasonNumber}` : null,
    title.releaseDate?.slice(0, 4) || "TBA",
    title.runtimeMinutes ? `${title.runtimeMinutes} min` : "Runtime unknown",
  ].filter(Boolean).join(" · ");
}

export function MarvelLibraryManager({ titles, refresh, toast }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [recordType, setRecordType] = useState("all");
  const [watched, setWatched] = useState("all");
  const [editing, setEditing] = useState(undefined);
  const [bulkOpen, setBulkOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = titles.filter((title) => {
    const matchesQuery = `${title.title} ${title.baseTitle || ""}`.toLowerCase().includes(normalizedQuery);
    const matchesRecord = recordType === "all"
      || (recordType === "season" ? Boolean(title.seasonNumber) : !title.seasonNumber);
    return matchesQuery
      && (type === "all" || title.type === type)
      && matchesRecord
      && (watched === "all" || title.isWatched === (watched === "watched"));
  });

  async function save(payload) {
    if (Array.isArray(payload)) await watchMarvelDb.createTitles(payload);
    else if (editing) await watchMarvelDb.updateTitle(editing.id, payload);
    else await watchMarvelDb.createTitle(payload);
    await refresh();
    setEditing(undefined);
    toast(Array.isArray(payload) ? `${payload.length} seasons added.` : "Marvel library updated.");
  }

  async function remove(title) {
    const dependents = titles.filter((item) => item.prerequisiteIds?.includes(title.id));
    const warning = dependents.length
      ? `\n\n${title.title} is used by ${dependents.length} title${dependents.length === 1 ? "" : "s"}. Deleting it will also remove it from those prerequisite lists.`
      : "";
    if (!window.confirm(`Delete ${title.title} from the Marvel library?${warning}`)) return;
    try {
      const result = await watchMarvelDb.deleteTitle(title.id);
      await refresh();
      toast(result.removedPrerequisiteCount
        ? `Title removed and ${result.removedPrerequisiteCount} prerequisite relation${result.removedPrerequisiteCount === 1 ? "" : "s"} cleaned up.`
        : "Title removed.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function updateWatched(title, isWatched) {
    try {
      await watchMarvelDb.setTitleWatched(title.id, isWatched);
      await refresh();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  return (
    <section className="wm-settings-section" id="library">
      <header><h2>Marvel Library</h2><div className="wm-library-header-actions"><button className="primary-button" type="button" onClick={() => setEditing(null)}><Plus aria-hidden="true" /> Add Title</button><button className="secondary-button" type="button" onClick={() => setBulkOpen(true)}><Layers3 aria-hidden="true" /> Bulk Add</button></div></header>
      <div className="wm-library-tools">
        <label className="archive-search"><Search aria-hidden="true" /><input type="search" aria-label="Search Marvel library" placeholder="Search local library" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="form-field"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option><option value="movie">Movies</option><option value="series">Series</option></select></label>
        <label className="form-field"><span>Record</span><select value={recordType} onChange={(event) => setRecordType(event.target.value)}><option value="all">All records</option><option value="whole">Whole titles</option><option value="season">Seasons</option></select></label>
        <label className="form-field"><span>Status</span><select value={watched} onChange={(event) => setWatched(event.target.value)}><option value="all">All status</option><option value="unwatched">Unwatched</option><option value="watched">Watched</option></select></label>
      </div>
      <div className="wm-library-grid">
        {filtered.map((title) => (
          <article className="wm-library-card" key={title.id}>
            <Poster src={getTmdbImageUrl(title.posterPath, "w342")} alt="" />
            <div><h3>{title.title}</h3><p>{titleMeta(title)}</p><p className="wm-prerequisite-count">{title.prerequisiteIds?.length || 0} prerequisite{title.prerequisiteIds?.length === 1 ? "" : "s"}</p><label className="checkbox-field"><input type="checkbox" checked={title.isWatched} onChange={(event) => updateWatched(title, event.target.checked)} /> Watched</label></div>
            <div className="wm-card-actions"><button type="button" aria-label={`Edit ${title.title}`} onClick={() => setEditing(title)}><Pencil aria-hidden="true" /></button><button type="button" aria-label={`Delete ${title.title}`} onClick={() => remove(title)}><Trash2 aria-hidden="true" /></button></div>
          </article>
        ))}
        {!filtered.length && <p className="wm-empty-row">No titles match these filters.</p>}
      </div>
      {editing !== undefined && <MarvelTitleForm existing={editing} titles={titles} onSave={save} onClose={() => setEditing(undefined)} />}
      {bulkOpen && <MarvelBulkAddModal titles={titles} refresh={refresh} toast={toast} onClose={() => setBulkOpen(false)} />}
    </section>
  );
}
