import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Medal, Star, Trophy } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { joinHistory } from "../features/history/HistoryGroups";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import { Poster } from "../components/ui/Poster";
import { formatRating } from "../utils/formatters";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./LeaderboardsPage.css";

export default function LeaderboardsPage() {
  useDocumentTitle("Leaderboards");
  const { movies, history, loading, error } = useArchive();
  const entries = useMemo(() => joinHistory(movies, history), [movies, history]);
  const years = useMemo(
    () => [...new Set(entries.map((entry) => entry.watched_at.slice(0, 4)))].sort().reverse(),
    [entries],
  );
  const [yearChoice, setYearChoice] = useState("");
  const selectedYear = years.includes(yearChoice) ? yearChoice : years[0] || "";
  const ranked = useMemo(() => {
    const byMovie = new Map();
    entries.forEach((entry) => {
      if (entry.watched_at.slice(0, 4) !== selectedYear) return;
      const rating = Number(entry.movie.rating);
      if (entry.movie.rating === "" || entry.movie.rating == null || !Number.isFinite(rating)) return;
      const key = String(entry.movie.id);
      const current = byMovie.get(key);
      if (!current || entry.watched_at > current.watched_at) byMovie.set(key, { ...entry, rating });
    });
    return [...byMovie.values()].sort((a, b) => b.rating - a.rating || a.movie.title.localeCompare(b.movie.title));
  }, [entries, selectedYear]);

  return (
    <main className="leaderboards-page page-shell">
      <header className="leaderboards-heading">
        <div className="leaderboards-heading-copy">
          <p className="eyebrow"><Trophy aria-hidden="true" /> YOUR WATCHED FILMS</p>
          <h1>Best of <span>{selectedYear || "the year"}.</span></h1>
          <p className="leaderboards-subtitle">The films you rated highest.</p>
        </div>
        <label className="leaderboards-year">
          <span>Year</span>
          <select aria-label="Leaderboard year" value={selectedYear} onChange={(event) => setYearChoice(event.target.value)} disabled={!years.length}>
            {years.length ? years.map((year) => <option key={year} value={year}>{year}</option>) : <option value="">No years yet</option>}
          </select>
        </label>
      </header>

      {loading ? <LoadingState>Loading your leaderboard…</LoadingState> : error ? <ErrorState>Your leaderboard could not be loaded.</ErrorState> : ranked.length ? (
        <>
          <div className="leaderboards-summary"><span>{ranked.length} {ranked.length === 1 ? "rated title" : "rated titles"}</span><span>Sorted by your rating</span></div>
          <section className="leaderboards-featured" aria-label={`Top films of ${selectedYear}`}>
            {ranked.slice(0, 3).map((entry, index) => <FeaturedFilm entry={entry} rank={index + 1} key={entry.movie.id} />)}
          </section>
          {ranked.length > 3 && <section className="leaderboards-rest" aria-label="More ranked films">
            <div className="leaderboards-list-heading"><h2>The rest of the list</h2><span>{ranked.length - 3} titles</span></div>
            <ol start={4}>
              {ranked.slice(3).map((entry, index) => <RankedFilm entry={entry} rank={index + 4} key={entry.movie.id} />)}
            </ol>
          </section>}
        </>
      ) : <div className="leaderboards-empty"><Medal aria-hidden="true" /><EmptyState>{selectedYear ? `No rated watched films for ${selectedYear} yet.` : "Your rated watched films will appear here."}</EmptyState><Link to="/history">Go to history <ArrowUpRight aria-hidden="true" /></Link></div>}
    </main>
  );
}

function FeaturedFilm({ entry, rank }) {
  return <article className={`leaderboard-featured-film leaderboard-rank-${rank}`}>
    <div className="leaderboard-poster-wrap">
      <Link to={`/movies/${encodeURIComponent(entry.movie.id)}`} aria-label={`Open ${entry.movie.title}`}>
        <Poster src={entry.movie.poster_url} alt={`${entry.movie.title} poster`} loading="lazy" />
      </Link>
      <span className="leaderboard-rank-badge">{rank === 1 ? <Trophy aria-label="First place" /> : <span>{String(rank).padStart(2, "0")}</span>}</span>
    </div>
    <div className="leaderboard-featured-meta">
      <span className="leaderboard-place">{rank === 1 ? "TOP RATED" : `RANK ${String(rank).padStart(2, "0")}`}</span>
      <Link className="leaderboard-title" to={`/movies/${encodeURIComponent(entry.movie.id)}`}>{entry.movie.title}</Link>
      <span className="leaderboard-film-year">{entry.movie.release_date?.slice(0, 4) || "Year unknown"} · {entry.movie.media_type}</span>
      <span className="leaderboard-rating"><Star aria-hidden="true" fill="currentColor" /> {formatRating(entry.rating)} <small>/ 10</small></span>
    </div>
  </article>;
}

function RankedFilm({ entry, rank }) {
  return <li className="leaderboard-ranked-film">
    <span className="leaderboard-list-rank">{String(rank).padStart(2, "0")}</span>
    <Link className="leaderboard-list-poster" to={`/movies/${encodeURIComponent(entry.movie.id)}`}><Poster src={entry.movie.poster_url} alt="" loading="lazy" /></Link>
    <div className="leaderboard-list-copy"><Link to={`/movies/${encodeURIComponent(entry.movie.id)}`}>{entry.movie.title}</Link><span>{entry.movie.release_date?.slice(0, 4) || "Year unknown"} · {entry.movie.media_type}</span></div>
    <span className="leaderboard-rating"><Star aria-hidden="true" fill="currentColor" /> {formatRating(entry.rating)} <small>/ 10</small></span>
  </li>;
}
