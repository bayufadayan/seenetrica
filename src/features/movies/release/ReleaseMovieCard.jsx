import { MovieCard } from "../../../components/common/MovieCard";
import { formatDate } from "../../../utils/formatters";
import { ReleaseMovieActions } from "./ReleaseMovieActions";

export function ReleaseMovieCard({ movie, timeline = false }) {
  return (
    <div className="release-film-card">
      <MovieCard
        key={movie.poster_url || "no-poster"}
        movie={movie}
        subtitle={timeline ? movie.media_type : `${movie.media_type} · ${formatDate(movie.release_date, { fallback: "Release date TBA" })}`}
      />
      <ReleaseMovieActions movie={movie} />
    </div>
  );
}
