import { Plus, Tags } from "lucide-react";
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
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const location = useLocation();
  const categoryActive = location.pathname.startsWith("/categories/");

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
          <div className="nav-category-menu" role="menu" aria-label="Categories">
            <div className="nav-category-heading">
              <span>Categories</span>
              <button
                type="button"
                aria-label="Add category"
                title="Add category"
                onClick={() => { setOpen(false); setFormOpen(true); }}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="nav-category-items">
              {categories.map((category) => {
                const path = `/categories/${encodeURIComponent(category.slug)}`;
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
                    <span>{categoryDisplayName(category.name)}</span>
                  </Link>
                );
              })}
              {!categories.length && <p className="nav-category-empty">Categories will appear after the first sync.</p>}
            </div>
          </div>
        )}
      </div>
      {formOpen && <CategoryFormModal onClose={() => setFormOpen(false)} />}
    </>
  );
}
