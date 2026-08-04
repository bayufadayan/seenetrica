import { Clock, Play, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "../../../components/ui/Modal";
import { Poster } from "../../../components/ui/Poster";
import { getEligibleTitles, pickUniqueRecommendation } from "../utils/recommendation.util";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";

function titleMeta(title) {
  return [title.type, title.seasonNumber ? `Season ${title.seasonNumber}` : null, title.releaseDate?.slice(0, 4), title.runtimeMinutes ? `${title.runtimeMinutes} min` : null].filter(Boolean).join(" · ");
}

export function SurpriseModal({ titles, history, setHistory, onClose, onPlay, busy }) {
  const eligible = getEligibleTitles(titles);
  const current = history.at(-1);
  const canAgain = history.length < Math.min(3, eligible.length);
  function again() {
    const next = pickUniqueRecommendation(titles, history.map((title) => title.id));
    if (next) setHistory((items) => [...items, next]);
  }
  return (
    <Modal title={current ? "Tonight's feature" : "No eligible feature"} onClose={onClose} busy={busy} className="wm-surprise-modal">
      {!current ? (
        <div className="wm-modal-empty"><p>Every title is watched, or a title still has unfinished prerequisites.</p><Link className="secondary-button" to="/watch-marvel/settings">Review library</Link></div>
      ) : (
        <>
          <div className="wm-surprise-art" style={{ "--wm-backdrop": `url(${getTmdbImageUrl(current.backdropPath, "original")})` }}>
            <Poster src={getTmdbImageUrl(current.posterPath, "w342")} alt={`Poster for ${current.title}`} />
            <div><h3>{current.title}</h3><p>{titleMeta(current)}</p><span><Clock aria-hidden="true" /> Prerequisites {current.prerequisiteIds?.length ? "complete" : "not required"}</span></div>
          </div>
          {history.length >= Math.min(3, eligible.length) && history.length > 1 && (
            <div className="wm-final-choices"><p>Final selection — choose one of tonight's draws.</p>{history.map((title) => <button type="button" key={title.id} disabled={busy} onClick={() => onPlay(title)}>{title.title}</button>)}</div>
          )}
          <div className="wm-modal-actions">
            <button className="primary-button" type="button" disabled={busy} onClick={() => onPlay(current)}><Play aria-hidden="true" /> {busy ? "Preparing…" : "Play Now"}</button>
            {canAgain && <button className="secondary-button" type="button" disabled={busy} onClick={again}><RefreshCw aria-hidden="true" /> Surprise Again</button>}
            <button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </Modal>
  );
}
