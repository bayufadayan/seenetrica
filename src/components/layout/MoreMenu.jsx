import { Clapperboard, EllipsisVertical, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./MoreMenu.css";

export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const location = useLocation();
  const moviesActive = location.pathname === "/movies";
  const leaderboardsActive = location.pathname === "/leaderboards";

  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    const frame = requestAnimationFrame(() => {
      rootRef.current?.querySelector("[role='menuitem']")?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  return (
    <div className="nav-category nav-more" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`nav-destination is-icon-only ${moviesActive ? "is-active" : ""}`}
        type="button"
        aria-label="More navigation"
        title="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <EllipsisVertical aria-hidden="true" />
      </button>
      {open && (
        <div className="nav-category-menu nav-more-menu" role="menu" aria-label="More">
          <Link
            className={`nav-category-item ${moviesActive ? "is-active" : ""}`}
            role="menuitem"
            to="/movies"
            onClick={() => setOpen(false)}
          >
            <Clapperboard aria-hidden="true" />
            <span>All Movies</span>
          </Link>
          <Link
            className={`nav-category-item ${leaderboardsActive ? "is-active" : ""}`}
            role="menuitem"
            to="/leaderboards"
            onClick={() => setOpen(false)}
          >
            <Trophy aria-hidden="true" />
            <span>Leaderboards</span>
          </Link>
        </div>
      )}
    </div>
  );
}
