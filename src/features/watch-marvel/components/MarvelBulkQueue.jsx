import { Trash2 } from "lucide-react";
import { Poster } from "../../../components/ui/Poster";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";
import { MarvelPrerequisiteSelector } from "./MarvelPrerequisiteSelector";

export function MarvelBulkQueue({ queue, titles, disabled, onChange, onRemove }) {
  if (!queue.length) return <p className="wm-empty-row">Search TMDB and add titles to build this batch.</p>;
  return (
    <div className="wm-bulk-queue">
      {queue.map((item, index) => (
        <article key={item.clientId}>
          <span className="wm-queue-number">{index + 1}</span>
          <Poster src={getTmdbImageUrl(item.posterPath, "w342")} alt="" />
          <div className="wm-queue-content">
            <div className="wm-queue-heading">
              <div><h3>{item.title}</h3><p>{item.type === "movie" ? "Movie" : "Series"}{item.seasonNumber ? ` · Season ${item.seasonNumber}` : ""} · {item.releaseDate?.slice(0, 4) || "TBA"}</p></div>
              <button type="button" disabled={disabled} aria-label={`Remove ${item.title}`} onClick={() => onRemove(item.clientId)}><Trash2 aria-hidden="true" /></button>
            </div>
            <label className="checkbox-field"><input type="checkbox" checked={item.isWatched} disabled={disabled} onChange={(event) => onChange(item.clientId, { isWatched: event.target.checked })} /> Watched</label>
            <MarvelPrerequisiteSelector titles={titles} value={item.prerequisiteIds} disabled={disabled} onChange={(prerequisiteIds) => onChange(item.clientId, { prerequisiteIds })} />
          </div>
        </article>
      ))}
    </div>
  );
}
