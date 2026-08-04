import { useState } from "react";
import { Menu, Plus, Search, Ticket } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

const navItems = [
  ["/", "Home"],
  ["/history", "History"],
  ["/watchlist", "Watchlist"],
  ["/planned", "Planned"],
];

export function Header({ onSearch }) {
  const [open, setOpen] = useState(false);
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
          <NavLink
            className={({ isActive }) =>
              `nav-cinema-link ${isActive ? "is-active" : ""}`
            }
            to="/cinema"
            aria-label="Open cinema diary"
            title="Cinema diary"
          >
            <Ticket aria-hidden="true" />
            <span>Cinema</span>
          </NavLink>
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
