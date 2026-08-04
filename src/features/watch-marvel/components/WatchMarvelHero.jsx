import { Play, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { getTmdbImageUrl } from "../utils/tmdb-image.util";

export function WatchMarvelHero({ titles, onSurprise }) {
  const unwatched = titles.filter((title) => !title.isWatched).length;
  const byId = new Map(titles.map((title) => [title.id, title]));
  const readySeries = titles.filter((title) => title.type === "series" && !title.isWatched && (title.prerequisiteIds || []).every((id) => byId.get(id)?.isWatched)).length;
  const artwork = titles.find((title) => title.backdropPath)?.backdropPath;
  return (
    <section className={`wm-hero ${artwork ? "has-artwork" : ""}`} style={artwork ? { "--wm-backdrop": `url(${getTmdbImageUrl(artwork, "original")})` } : undefined}>
      <div className="wm-hero-copy">
        <h1>Tonight, the archive <em>chooses.</em></h1>
        <p>Pick a local feature, line up trailers and advertisements, then begin at the next five-minute broadcast mark.</p>
        <div className="button-row">
          <button className="primary-button" type="button" disabled={!titles.length} onClick={onSurprise}><Play aria-hidden="true" /> Surprise Me!</button>
          <Link className="secondary-button" to="/watch-marvel/settings"><Settings aria-hidden="true" /> Settings</Link>
        </div>
        {!titles.length && <p className="wm-hero-empty">Your Marvel library is empty. Add a title in Settings to begin.</p>}
      </div>
      <dl className="wm-stats">
        <div><dt>Titles archived</dt><dd>{titles.length}</dd></div>
        <div><dt>Still unwatched</dt><dd>{unwatched}</dd></div>
        <div><dt>Series ready</dt><dd>{readySeries}</dd></div>
      </dl>
    </section>
  );
}
