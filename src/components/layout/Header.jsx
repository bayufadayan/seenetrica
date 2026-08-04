import { useEffect, useRef, useState } from "react";
import { Ellipsis, Menu, Plus, Search, Ticket } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";

const navItems = [
  ["/", "Home"],
  ["/history", "History"],
  ["/watchlist", "Watchlist"],
  ["/planned", "Planned"],
];

export function Header({ onSearch }) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const location = useLocation();
  const cinemaActive = location.pathname.startsWith("/cinema");
  const marvelActive = location.pathname.startsWith("/watch-marvel");

  useEffect(() => {
    if (!moreOpen) return undefined;
    const closeOutside = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        moreRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [moreOpen]);

  return (
    <header className="site-header">
      <nav className="floating-nav" aria-label="Primary navigation">
        <Link className="brand" to="/" aria-label="Seenetrica home">
          <img
            className="brand-mark"
            src="/assets/favicon.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="brand-name">Seenetrica</span>
        </Link>
        <div className={`nav-links ${open ? "is-open" : ""}`}>
          {navItems.map(([to, label]) => (
            <NavLink
              className={({ isActive }) =>
                `nav-link ${isActive ? "is-active" : ""}`
              }
              end={to === "/"}
              key={to}
              onClick={() => setOpen(false)}
              to={to}
            >
              {label}
            </NavLink>
          ))}
        </div>
        <div className="nav-actions">
          <div className="nav-more" ref={moreRef}>
            <button
              className={`nav-more-button ${cinemaActive || marvelActive ? "is-active" : ""}`}
              type="button"
              aria-label="More destinations"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((value) => !value)}
            >
              <Ellipsis aria-hidden="true" />
              <span>More</span>
            </button>
            {moreOpen && (
              <div className="nav-more-menu" role="menu" aria-label="More destinations">
                <Link
                  className={`nav-more-item ${cinemaActive ? "is-active" : ""}`}
                  role="menuitem"
                  to="/cinema"
                  onClick={() => setMoreOpen(false)}
                >
                  <Ticket aria-hidden="true" />
                  <span>Cinema</span>
                </Link>
                <Link
                  className={`nav-more-item ${marvelActive ? "is-active" : ""}`}
                  role="menuitem"
                  to="/watch-marvel"
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="marvel-nav-badge" aria-hidden="true">M</span>
                  <span>Watch Marvel</span>
                </Link>
              </div>
            )}
          </div>
          <span className="nav-action-divider" aria-hidden="true" />
          <Link
            className="icon-button"
            to="/add-movie"
            aria-label="Add movie"
            title="Add movie"
          >
            <Plus aria-hidden="true" />
          </Link>
          <button
            className="icon-button"
            type="button"
            aria-label="Search archive"
            onClick={onSearch}
          >
            <Search aria-hidden="true" />
          </button>
          <button
            className="icon-button menu-button"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </nav>
    </header>
  );
}
