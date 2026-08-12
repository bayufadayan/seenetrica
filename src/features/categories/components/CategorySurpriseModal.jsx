import { Clock, Play, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "../../../components/ui/Modal";
import { Poster } from "../../../components/ui/Poster";
import { getEligibleTitles, pickUniqueRecommendation } from "../utils/recommendation.util";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";

export function CategorySurpriseModal({ category, titles, history, setHistory, onClose, onPlay, busy }) {
  const eligible = getEligibleTitles(titles);
  const current = history.at(-1);
  const canAgain = history.length < Math.min(3, eligible.length);
  return (
    <Modal title={current ? "Tonight's feature" : "No eligible feature"} onClose={onClose} busy={busy} className="wm-surprise-modal">
      {!current ? <div className="wm-modal-empty"><p>Every title is watched, or a title still has unfinished prerequisites.</p><Link className="secondary-button" to={`/categories/${category.slug}/settings`}>Review library</Link></div> : <>
        <div className="wm-surprise-art" style={{ "--wm-backdrop": `url(${getTmdbImageUrl(current.backdropPath, "original")})` }}><Poster src={getTmdbImageUrl(current.posterPath, "w342")} alt={`Poster for ${current.title}`} /><div><h3>{current.title}</h3><p>{current.type} · {current.releaseDate?.slice(0, 4) || "TBA"}</p><span><Clock aria-hidden="true" /> Prerequisites {current.prerequisiteIds?.length ? "complete" : "not required"}</span></div></div>
        {history.length >= Math.min(3, eligible.length) && history.length > 1 && <div className="wm-final-choices"><p>Final selection — choose one of tonight's draws.</p>{history.map((title) => <button type="button" key={title.id} disabled={busy} onClick={() => onPlay(title)}>{title.title}</button>)}</div>}
        <div className="wm-modal-actions"><button className="primary-button" type="button" disabled={busy} onClick={() => onPlay(current)}><Play aria-hidden="true" /> {busy ? "Preparing…" : "Play Now"}</button>{canAgain && <button className="secondary-button" type="button" disabled={busy} onClick={() => { const next = pickUniqueRecommendation(titles, history.map((title) => title.id)); if (next) setHistory((items) => [...items, next]); }}><RefreshCw aria-hidden="true" /> Surprise Again</button>}<button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
      </>}
    </Modal>
  );
}
