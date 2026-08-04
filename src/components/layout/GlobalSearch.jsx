import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, History, Search, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useArchive } from "../../context/ArchiveContext";
import { useBodyLock } from "../../hooks/useBodyLock";
import { STORAGE_KEYS } from "../../utils/constants";
import { storage } from "../../utils/storage";
import { Poster } from "../ui/Poster";

export function GlobalSearch({ open, onClose, onOpen }) {
  const { movies } = useArchive();
  const location = useLocation();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(() =>
    storage.get(STORAGE_KEYS.searches, []),
  );
  useBodyLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const keydown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", keydown);
    };
  }, [open, onClose]);

  useEffect(() => {
    const keydown = (event) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        ) &&
        location.pathname !== "/"
      ) {
        event.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [location.pathname, onOpen]);

  if (!open) return null;
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? movies
        .filter((movie) => movie.title.toLowerCase().includes(normalized))
        .slice(0, 7)
    : [];

  function remember(term) {
    const clean = term.trim();
    if (!clean) return;
    const next = [
      clean,
      ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, 5);
    setRecent(next);
    storage.set(STORAGE_KEYS.searches, next);
  }

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <div className="search-modal">
      <button
        className="search-backdrop"
        type="button"
        aria-label="Close search"
        onClick={close}
      />
      <section
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
      >
        <div className="search-dialog-header">
          <h2 id="search-dialog-title">Find a title</h2>
          <button
            className="icon-button light-icon-button"
            type="button"
            aria-label="Close search"
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <label className="modal-search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Search all saved titles</span>
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            placeholder="Type a movie or series title"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && remember(query)}
          />
        </label>
        {!normalized ? (
          <div className="search-content">
            <div className="search-subheading">
              <h3>Recent searches</h3>
              <button
                type="button"
                onClick={() => {
                  setRecent([]);
                  storage.remove(STORAGE_KEYS.searches);
                }}
              >
                Clear
              </button>
            </div>
            <div className="recent-search-list">
              {recent.length ? (
                recent.map((term) => (
                  <button
                    className="recent-search-chip"
                    type="button"
                    key={term}
                    onClick={() => setQuery(term)}
                  >
                    <History aria-hidden="true" />
                    {term}
                  </button>
                ))
              ) : (
                <p className="no-recent-searches">No recent searches yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="search-content">
            {matches.length ? (
              matches.map((movie) => (
                <Link
                  className="search-result-card"
                  to={`/movies/${encodeURIComponent(movie.id)}`}
                  key={movie.id}
                  onClick={() => {
                    remember(movie.title);
                    close();
                  }}
                >
                  <Poster src={movie.poster_url} alt="" loading="lazy" />
                  <div>
                    <h3>{movie.title}</h3>
                    <p>
                      {movie.media_type} ·{" "}
                      {movie.release_date?.slice(0, 4) || "TBA"}
                    </p>
                  </div>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              ))
            ) : (
              <p className="search-empty">No title found in your archive.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
