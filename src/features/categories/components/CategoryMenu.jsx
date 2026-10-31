import { Clapperboard, Plus, Tags } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCategories } from "../context/CategoriesProvider";
import { categoryDisplayName } from "../utils/category.util";
import { closeCategoryMenuWithEscape, shouldCloseCategoryMenu } from "../utils/category-menu.util";
import { CategoryFormModal } from "./CategoryFormModal";
import { CategoryIcon } from "./CategoryIcon";

export function CategoryMenu() {
  const { categories } = useCategories();
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [activeKind, setActiveKind] = useState("category");
  const [formKind, setFormKind] = useState("category");
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const location = useLocation();
  const categoryActive = location.pathname === "/categories" || location.pathname.startsWith("/categories/") || location.pathname.startsWith("/series");
  const visibleCollections = categories.filter((item) => (item.kind || "category") === activeKind);

  useEffect(() => {
    setActiveKind(location.pathname.startsWith("/series") ? "series" : "category");
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (shouldCloseCategoryMenu(rootRef.current, event.target)) setOpen(false);
    };
    const closeWithEscape = (event) => {
      closeCategoryMenuWithEscape(event, () => setOpen(false), triggerRef.current);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    const frame = requestAnimationFrame(() => {
      rootRef.current?.querySelector("[role='menuitem'], .nav-category-heading button")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  return (
    <>
      <div className="nav-category" ref={rootRef}>
        <button
          ref={triggerRef}
          className={`nav-destination is-icon-only ${categoryActive ? "is-active" : ""}`}
          type="button"
          aria-label="Categorize"
          title="Categorize"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Tags aria-hidden="true" />
        </button>
        {open && (
          <div className="nav-category-menu" role="menu" aria-label="Categories and series">
            <div className="nav-category-heading">
              <span>{activeKind === "series" ? "Series" : "Categories"}</span>
              <button
                type="button"
                aria-label={activeKind === "series" ? "Add series" : "Add category"}
                title={activeKind === "series" ? "Add series" : "Add category"}
                onClick={() => { setFormKind(activeKind); setOpen(false); setFormOpen(true); }}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="nav-category-tabs" role="tablist" aria-label="Collection type">
              <button className={activeKind === "category" ? "is-active" : ""} type="button" role="tab" aria-selected={activeKind === "category"} onClick={() => setActiveKind("category")}><Tags aria-hidden="true" />Categories</button>
              <button className={activeKind === "series" ? "is-active" : ""} type="button" role="tab" aria-selected={activeKind === "series"} onClick={() => setActiveKind("series")}><Clapperboard aria-hidden="true" />Series</button>
            </div>
            <div className="nav-category-items">
              {visibleCollections.map((category) => {
                const isSeries = activeKind === "series";
                const path = isSeries ? `/series/${encodeURIComponent(category.slug)}` : `/categories/${encodeURIComponent(category.slug)}`;
                const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
                return (
                  <Link
                    className={`nav-category-item ${active ? "is-active" : ""}`}
                    key={category.id}
                    role="menuitem"
                    to={path}
                    onClick={() => setOpen(false)}
                  >
                    <CategoryIcon category={category} />
                    <span>{isSeries ? category.name : categoryDisplayName(category.name)}</span>
                  </Link>
                );
              })}
              {!visibleCollections.length && <p className="nav-category-empty">{activeKind === "series" ? "No series yet. Add one to get started." : "Categories will appear after the first sync."}</p>}
              {activeKind === "series" && <Link className="nav-category-item nav-series-all" role="menuitem" to="/series" onClick={() => setOpen(false)}>View all series</Link>}
              {activeKind === "category" && <Link className="nav-category-item nav-series-all" role="menuitem" to="/categories" onClick={() => setOpen(false)}>View all categories</Link>}
            </div>
          </div>
        )}
      </div>
      {formOpen && <CategoryFormModal kind={formKind} onClose={() => setFormOpen(false)} />}
    </>
  );
}
