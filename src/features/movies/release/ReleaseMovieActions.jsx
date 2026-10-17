import { CalendarDays, EllipsisVertical, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useArchive } from "../../../context/ArchiveContext";
import { useToast } from "../../../context/ToastContext";
import { Modal } from "../../../components/ui/Modal";
import { archiveService } from "../../../services/archive.service";
import { tmdbService } from "../../../services/tmdb.service";

export function ReleaseMovieActions({ movie }) {
  const { refresh } = useArchive();
  const toast = useToast();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [releaseDate, setReleaseDate] = useState("");
  const [busy, setBusy] = useState(false);
  const hasTmdb = movie.external_source === "tmdb" && Number(movie.external_id) > 0;

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  function askForPin() {
    const pin = archiveService.askForPin();
    if (pin === "") toast("PIN is required.", "error");
    return pin;
  }

  async function saveReleaseDate(event) {
    event.preventDefault();
    if (busy) return;
    const pin = askForPin();
    if (!pin) return;

    setBusy(true);
    try {
      await archiveService.writeAction("updateMovie", {
        id: movie.id,
        release_date: releaseDate || null,
      }, pin);
      await refresh();
      setDateOpen(false);
      toast("Release date updated.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function refreshPoster() {
    if (!hasTmdb || busy) return;
    setMenuOpen(false);
    setBusy(true);
    try {
      const details = await tmdbService.getDetails(movie.external_id, movie.media_type);
      const seasonNumber = Number(movie.season_number);
      const season = seasonNumber > 0
        ? details.seasons?.find((item) => item.season_number === seasonNumber)
        : null;
      if (seasonNumber > 0 && !season) {
        throw new Error("This season could not be found on TMDB.");
      }

      const posterPath = season ? season.poster_path : details.poster_path;
      if (!posterPath) throw new Error("TMDB has no poster available for this title.");
      const posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
      if (posterPath === movie.poster_path && posterUrl === movie.poster_url) {
        toast("The poster is already up to date.");
        return;
      }

      const pin = askForPin();
      if (!pin) return;
      await archiveService.writeAction("updateMovie", {
        id: movie.id,
        poster_path: posterPath,
        poster_url: posterUrl,
      }, pin);
      await refresh();
      toast("Poster refreshed from TMDB.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="release-card-actions" ref={menuRef}>
        <button
          type="button"
          className="release-actions-trigger"
          aria-label={`Actions for ${movie.title}`}
          aria-expanded={menuOpen}
          disabled={busy}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {busy ? <RefreshCw aria-hidden="true" className="release-spin" /> : <EllipsisVertical aria-hidden="true" />}
        </button>
        {menuOpen && (
          <div className="release-actions-menu" role="group" aria-label={`${movie.title} actions`}>
            <button
              type="button"
              onClick={() => {
                setReleaseDate(movie.release_date || "");
                setDateOpen(true);
                setMenuOpen(false);
              }}
            >
              <CalendarDays aria-hidden="true" /> Edit release date
            </button>
            <button
              type="button"
              disabled={!hasTmdb}
              title={hasTmdb ? "Check TMDB for the latest poster" : "Available for TMDB entries only"}
              onClick={refreshPoster}
            >
              <RefreshCw aria-hidden="true" /> Refresh poster
            </button>
          </div>
        )}
      </div>
      {dateOpen && createPortal(
        <Modal title="Edit release date" busy={busy} onClose={() => setDateOpen(false)} className="release-edit-modal">
          <form onSubmit={saveReleaseDate} className="release-date-form">
            <p>Update the release date for <strong>{movie.title}</strong>. Leave it empty to mark the date as TBA.</p>
            <label className="form-field">
              <span>Release date</span>
              <input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} />
            </label>
            <div className="release-date-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={() => setDateOpen(false)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save date"}</button>
            </div>
          </form>
        </Modal>,
        document.body,
      )}
    </>
  );
}
