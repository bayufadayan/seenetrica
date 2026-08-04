import { ArrowRight, Plus, Search } from "lucide-react";
import { useState } from "react";
import { tmdbService } from "../../services/tmdb.service";
import { Poster } from "../../components/ui/Poster";

export function TmdbSearchPanel({ bulk = false, disabled = false, getActions, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState(
    disabled
      ? "Choose a month before searching."
      : "Search for a movie or series to begin.",
  );
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(null);

  async function search(nextPage = 1) {
    if (query.trim().length < 2 || busy) return;
    setBusy(true);
    setStatus("Searching TMDB…");
    if (nextPage === 1) setResults([]);
    try {
      const payload = await tmdbService.search(query.trim(), nextPage);
      setResults((current) =>
        nextPage === 1
          ? payload.results
          : [
              ...new Map(
                [...current, ...payload.results].map((item) => [
                  `${item.media_type}:${item.external_id}`,
                  item,
                ]),
              ).values(),
            ],
      );
      setPage(payload.page);
      setTotalPages(payload.totalPages);
      setStatus(
        `${nextPage === 1 ? payload.results.length : results.length + payload.results.length} movie and series results loaded${payload.totalPages > 1 ? ` · page ${payload.page} of ${payload.totalPages}` : ""}`,
      );
    } catch (error) {
      setStatus(error.message);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function select(item, action = null) {
    if (selecting) return;
    setSelecting(`${item.media_type}:${item.external_id}:${action || "default"}`);
    setStatus("Loading title details…");
    try {
      const details = await tmdbService.getDetails(
        item.external_id,
        item.media_type,
      );
      await onSelect(details, action);
      setStatus(
        bulk
          ? `${details.title} added to the list.`
          : "Title selected. Complete your entry.",
      );
    } catch (error) {
      setStatus(error.message);
      throw error;
    } finally {
      setSelecting(null);
    }
  }

  return (
    <>
      <form
        className="tmdb-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          search(1).catch(() => {});
        }}
      >
        <label
          className="sr-only"
          htmlFor={bulk ? "bulkTmdbQuery" : "tmdbQuery"}
        >
          Movie or series title
        </label>
        <input
          id={bulk ? "bulkTmdbQuery" : "tmdbQuery"}
          type="search"
          minLength="2"
          autoComplete="off"
          placeholder={
            disabled
              ? "Choose a month first"
              : bulk
                ? "Search a movie or series"
                : "Try Interstellar or Dark"
          }
          disabled={disabled || busy}
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={`primary-button ${busy ? "is-loading" : ""}`}
          type="submit"
          disabled={disabled || busy}
          aria-busy={busy}
        >
          <Search aria-hidden="true" />
          <span className="button-spinner" hidden={!busy} />
          <span>{busy ? "Searching…" : "Search"}</span>
        </button>
      </form>
      <p className="collection-status" role="status">
        {status}
      </p>
      <div
        className={`tmdb-results ${bulk ? "bulk-tmdb-results" : ""}`}
        aria-live="polite"
        aria-busy={busy || Boolean(selecting)}
      >
        {busy && !results.length
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                className="tmdb-result-skeleton"
                aria-hidden="true"
                key={index}
              >
                <span className="skeleton-block skeleton-poster" />
                <span className="skeleton-copy">
                  <span className="skeleton-block skeleton-title" />
                  <span className="skeleton-block skeleton-meta" />
                </span>
              </div>
            ))
          : results.map((item) =>
              getActions ? (
                <article
                  className="tmdb-result wm-tmdb-result"
                  key={`${item.media_type}:${item.external_id}`}
                >
                  <Poster src={item.poster_url} alt="" loading="lazy" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.media_type} · {item.release_date?.slice(0, 4) || "TBA"}</p>
                  </div>
                  <div className="wm-tmdb-actions">
                    {getActions(item).map((action) => (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={Boolean(selecting)}
                        key={action.id}
                        onClick={() => select(item, action.id).catch(() => {})}
                      >
                        {selecting === `${item.media_type}:${item.external_id}:${action.id}`
                          ? "Loadingâ€¦"
                          : action.label}
                      </button>
                    ))}
                  </div>
                </article>
              ) : bulk ? (
                <article
                  className="tmdb-result bulk-tmdb-result"
                  key={`${item.media_type}:${item.external_id}`}
                >
                  <Poster src={item.poster_url} alt="" loading="lazy" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.media_type} ·{" "}
                      {item.release_date?.slice(0, 4) || "TBA"}
                    </p>
                  </div>
                  <button
                    className={`bulk-add-result-button ${selecting === `${item.media_type}:${item.external_id}:default` ? "is-loading" : ""}`}
                    type="button"
                    disabled={Boolean(selecting)}
                    onClick={() => select(item).catch(() => {})}
                  >
                    <span className="result-spinner" />
                    <Plus aria-hidden="true" />
                    <span>Add to list</span>
                  </button>
                </article>
              ) : (
                <button
                  className={`tmdb-result ${selecting === `${item.media_type}:${item.external_id}:default` ? "is-loading is-selected" : ""}`}
                  type="button"
                  disabled={Boolean(selecting)}
                  key={`${item.media_type}:${item.external_id}`}
                  aria-label={`Select ${item.title}`}
                  onClick={() => select(item).catch(() => {})}
                >
                  <Poster src={item.poster_url} alt="" loading="lazy" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.media_type} ·{" "}
                      {item.release_date?.slice(0, 4) || "TBA"}
                    </p>
                  </div>
                  <span className="tmdb-result-action" aria-hidden="true">
                    <ArrowRight className="result-arrow" />
                    <span className="result-spinner" />
                  </span>
                </button>
              ),
            )}
        {page < totalPages && (
          <button
            className="secondary-button tmdb-load-more-button"
            type="button"
            disabled={busy}
            onClick={() => search(page + 1).catch(() => {})}
          >
            Load more results
          </button>
        )}
      </div>
    </>
  );
}
