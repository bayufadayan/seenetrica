import { useMemo, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import { useCategories } from "../context/CategoriesProvider";
import {
  cleanupCategoryIcon,
  uploadCategoryIcon,
  validateCategoryIcon,
} from "../services/category-icon.service";
import { createCategorySlug, normalizeCategoryName } from "../utils/category.util";
import { CategoryIcon } from "./CategoryIcon";

export function CategoryFormModal({ existing = null, onClose }) {
  const categories = useCategories();
  const toast = useToast();
  const [name, setName] = useState(existing?.name || "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const normalizedName = normalizeCategoryName(name);
  const slug = useMemo(
    () => existing?.slug || createCategorySlug(normalizedName),
    [existing?.slug, normalizedName],
  );

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!normalizedName) {
      setError("Category name is required.");
      return;
    }
    if (!existing && !file) {
      setError("A new category requires an icon.");
      return;
    }
    if (categories.categories.some((category) => category.id !== existing?.id && category.slug === slug)) {
      setError("A category with this slug already exists.");
      return;
    }

    let uploaded = null;
    let pin = null;
    setBusy(true);
    try {
      if (file) {
        validateCategoryIcon(file);
        pin = archiveService.askForPin();
        if (pin === null) return;
        if (!pin) throw new Error("PIN is required to upload the category icon.");
        uploaded = await uploadCategoryIcon(file, slug, pin);
      }
      const payload = {
        name: normalizedName,
        slug,
        ...(uploaded || {}),
        ...(uploaded && existing?.iconPublicId
          ? { cleanupIconPublicId: existing.iconPublicId }
          : {}),
      };
      if (existing) await categories.updateCategory(existing.id, payload);
      else await categories.createCategory(payload);
      toast(`${normalizedName} Films saved locally. Sync will continue in the background.`);
      onClose();
    } catch (nextError) {
      let cleanupError = null;
      if (uploaded?.iconPublicId && pin) {
        try { await cleanupCategoryIcon(uploaded.iconPublicId, pin); } catch (error) { cleanupError = error; }
      }
      setError(cleanupError
        ? `${nextError.message} The uploaded icon could not be cleaned up: ${cleanupError.message}`
        : nextError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={existing ? "Edit category" : "Add category"}
      onClose={onClose}
      busy={busy}
      className="category-form-modal"
    >
      <form className="category-form" onSubmit={submit}>
        {existing && <div className="category-form-current"><CategoryIcon category={existing} /><span>Current icon</span></div>}
        <label className="form-field">
          <span>Category name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="off" />
          <small>Shown as {normalizedName ? `${normalizedName} Films` : "Category Films"}</small>
        </label>
        <label className="form-field">
          <span>{existing ? "Replace icon (optional)" : "Icon"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={!existing}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <small>JPG, PNG, or WebP. Center-cropped to a 96×96 WebP on this device.</small>
        </label>
        {error && <p className="wm-field-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save category"}
          </button>
          <button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
