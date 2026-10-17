import { CalendarPlus, Clapperboard, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./AddActionMenu.css";

export function AddActionMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const location = useLocation();
  const active = location.pathname === "/add-movie" || location.pathname === "/log-viewing";

  useEffect(() => {
    if (!open) return undefined;
    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeEscape(event) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    const frame = requestAnimationFrame(() => rootRef.current?.querySelector("[role='menuitem']")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div className="nav-category nav-add-action" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`icon-button ${active ? "is-active" : ""}`}
        type="button"
        aria-label="Add to Seenetrica"
        title="Add"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus aria-hidden="true" />
      </button>
      {open && (
        <div className="nav-category-menu nav-add-action-menu" role="menu" aria-label="Add">
          <Link role="menuitem" className="nav-category-item" to="/add-movie" onClick={() => setOpen(false)}>
            <Clapperboard aria-hidden="true" />
            <span>Add Movie</span>
          </Link>
          <Link role="menuitem" className="nav-category-item" to="/log-viewing" onClick={() => setOpen(false)}>
            <CalendarPlus aria-hidden="true" />
            <span>Log a Viewing</span>
          </Link>
        </div>
      )}
    </div>
  );
}
