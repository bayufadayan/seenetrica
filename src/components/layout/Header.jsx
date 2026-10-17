import { useState } from "react";
import { Menu, Search, Ticket, Tv } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { CategoryMenu } from "../../features/categories/components/CategoryMenu";
import { AddActionMenu } from "./AddActionMenu";
import { MoreMenu } from "./MoreMenu";

const navItems = [
  ["/", "Home"],
  ["/history", "History"],
  ["/watchlist", "Watchlist"],
  ["/planned", "Planned"],
];

export function Header({ onSearch }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const cinemaActive = location.pathname.startsWith("/cinema");
  const anythingActive = location.pathname.startsWith("/watch-anything");

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
          <NavLink className="nav-link nav-mobile-only" to="/watch-anything" onClick={() => setOpen(false)}>Watch Anything</NavLink>
          <NavLink className="nav-link nav-mobile-only" to="/cinema" onClick={() => setOpen(false)}>Cinema</NavLink>
        </div>
        <div className="nav-actions">
          <CategoryMenu />
          <Link
            className={`nav-destination is-icon-only ${anythingActive ? "is-active" : ""}`}
            to="/watch-anything"
            aria-label="Watch Anything"
            title="Watch Anything"
          >
            <Tv aria-hidden="true" />
          </Link>
          <Link className={`nav-destination ${cinemaActive ? "is-active" : ""}`} to="/cinema">
            <Ticket aria-hidden="true" /><span>Cinema</span>
          </Link>
          <MoreMenu />
          <span className="nav-action-divider" aria-hidden="true" />
          <AddActionMenu />
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
