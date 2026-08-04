import { Clapperboard, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRating } from "../../utils/formatters";
import { Poster } from "../ui/Poster";

export function MovieCard({ movie, subtitle, dateBadge, inTheater = false }) {
  const detail = `/movies/${encodeURIComponent(movie.id)}`;
  const cardSubtitle =
    subtitle ||
    `${movie.media_type} · ${movie.release_date?.slice(0, 4) || "TBA"}`;
  return (
    <article className="movie-card">
      <Link
        className="poster-link"
        to={detail}
        aria-label={`View ${movie.title} details`}
      >
        <div className="poster-frame">
          <Poster
            src={movie.poster_url}
            alt={`${movie.title} poster`}
            loading="lazy"
          />
          {inTheater && (
            <span className="cinema-badge">
              <Clapperboard aria-hidden="true" />
              In theaters
            </span>
          )}
          {dateBadge && <span className="planned-date">{dateBadge}</span>}
        </div>
      </Link>
      <div className="movie-meta">
        <div className="movie-meta-copy">
          <Link className="movie-title" to={detail}>
            {movie.title}
          </Link>
          <p className="movie-subtitle">{cardSubtitle}</p>
        </div>
        <span
          className="rating"
          aria-label={`Rating ${formatRating(movie.rating)}`}
        >
          <Star aria-hidden="true" />
          {formatRating(movie.rating)}
        </span>
      </div>
    </article>
  );
}
