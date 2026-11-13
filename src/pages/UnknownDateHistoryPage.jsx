import { Link } from "react-router-dom";
import { useArchive } from "../context/ArchiveContext";
import { PageHero } from "../components/common/PageHero";
import { MovieCard } from "../components/common/MovieCard";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { annotateRewatchNumbers, getRewatchLabel } from "../features/history/rewatch.util";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function UnknownDateHistoryPage() {
  useDocumentTitle("Unknown date history");
  const { movies, history, loading, error } = useArchive();
  const movieMap = new Map(movies.map((movie) => [String(movie.id), movie]));
  const entries = annotateRewatchNumbers(history).filter((entry) => !String(entry.watched_at || "").trim() && movieMap.has(String(entry.movie_id)));
  return <>
    <PageHero title="Watched," accent="date unknown." description="Stories you remember watching, even when the date escapes you." count={entries.length} countLabel="viewing entries" />
    <section className="page-content page-shell">
      {loading ? <LoadingState>Loading history…</LoadingState> : error ? <ErrorState>History could not be loaded.</ErrorState> : entries.length ? <div className="collection-grid">{entries.map((entry) => <MovieCard key={entry.id} movie={movieMap.get(String(entry.movie_id))} subtitle="Watched · Date unknown" rewatchLabel={getRewatchLabel(entry.watchNumber)} />)}</div> : <EmptyState>No viewings with an unknown date yet.</EmptyState>}
      <Link className="section-link" to="/history">View dated history</Link>
    </section>
  </>;
}
