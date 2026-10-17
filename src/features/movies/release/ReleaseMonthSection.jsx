import { ReleaseMovieCard } from "./ReleaseMovieCard";
import { formatReleaseDay } from "./release-groups";

export function ReleaseMonthSection({ group, timeline = false }) {
  return (
    <section className={`release-month-section ${timeline ? "is-timeline" : "is-grid"} ${timeline && group.isCurrentMonth ? "is-current-month" : ""}`} aria-label={group.label}>
      <header className="release-month-heading">
        <div>
          <h2>{group.label}</h2>
          <span>{group.movies.length} {group.movies.length === 1 ? "title" : "titles"}</span>
        </div>
        {timeline && group.isCurrentMonth && <span className="release-current-month">This month</span>}
      </header>
      {timeline ? (
        <div className="release-timeline-scroll" tabIndex={0} role="region" aria-label={`${group.label} release timeline, scroll horizontally`}>
          <div className={`release-timeline-track ${group.key === "tba" ? "is-tba" : ""}`}>
            {group.movies.map((movie) => (
              <div className="release-timeline-item" key={movie.id}>
                <span className="release-timeline-node" aria-hidden="true" />
                <time dateTime={movie.release_date || undefined} className="release-timeline-date">{formatReleaseDay(movie.release_date)}</time>
                <ReleaseMovieCard movie={movie} timeline />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="release-month-grid">
          {group.movies.map((movie) => <ReleaseMovieCard movie={movie} key={movie.id} />)}
        </div>
      )}
    </section>
  );
}
