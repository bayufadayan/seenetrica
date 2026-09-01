import { RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import { useCategories } from "../context/CategoriesProvider";
import {
  buildCategoryIconPatch,
  cleanupCategoryIcon,
  uploadCategoryIcon,
  validateCategoryIcon,
} from "../services/category-icon.service";
import {
  createCategorySlug,
  normalizeCategoryName,
} from "../utils/category.util";
import { CategoryIcon } from "./CategoryIcon";

export function CategoryFormModal({ existing = null, onClose }) {
  const categories = useCategories();
  const toast = useToast();
  const fileInput = useRef(null);
  const [name, setName] = useState(existing?.name || "");
  const [file, setFile] = useState(null);
  const [removeIcon, setRemoveIcon] = useState(false);
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
    if (categorySlugExists()) {
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
        if (!pin) {
          throw new Error("PIN is required to upload the category icon.");
        }
        uploaded = await uploadCategoryIcon(file, slug, pin);
      }

      const payload = {
        name: normalizedName,
        slug,
        ...buildCategoryIconPatch({ existing, uploaded, removeIcon }),
      };

      if (existing) await categories.updateCategory(existing.id, payload);
      else await categories.createCategory(payload);

      toast(
        `${normalizedName} Films saved locally. Sync will continue in the background.`,
      );
      onClose();
    } catch (nextError) {
      setError(await getSaveError(nextError, uploaded, pin));
    } finally {
      setBusy(false);
    }
  }

  function categorySlugExists() {
    return categories.categories.some(
      (category) =>
        category.id !== existing?.id && category.slug === slug,
    );
  }

  function selectIcon(event) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) setRemoveIcon(false);
  }

  function toggleIconRemoval() {
    const shouldRemove = !removeIcon;
    setRemoveIcon(shouldRemove);

    if (shouldRemove) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const hasExistingIcon = Boolean(existing?.iconUrl || existing?.iconPublicId);
  const previewCategory = removeIcon
    ? { ...existing, iconUrl: null, iconPublicId: null }
    : existing;

  return (
    <Modal
      title={existing ? "Edit category" : "Add category"}
      onClose={onClose}
      busy={busy}
      className="category-form-modal"
    >
      <form className="category-form" onSubmit={submit}>
        {existing && (
          <CurrentIcon
            category={previewCategory}
            hasExistingIcon={hasExistingIcon}
            removeIcon={removeIcon}
            busy={busy}
            onToggleRemoval={toggleIconRemoval}
          />
        )}

        <label className="form-field">
          <span>Category name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="off"
          />
          <small>
            Shown as {normalizedName ? `${normalizedName} Films` : "Category Films"}
          </small>
        </label>

        <label className="form-field">
          <span>{existing ? "Replace icon (optional)" : "Icon (optional)"}</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectIcon}
          />
          <small>
            Leave empty to use the default clapperboard icon. JPG, PNG, or WebP
            files are center-cropped to 96×96 WebP.
          </small>
        </label>

        {error && (
          <p className="wm-field-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save category"}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CurrentIcon({
  category,
  hasExistingIcon,
  removeIcon,
  busy,
  onToggleRemoval,
}) {
  const heading = removeIcon || !category.iconUrl ? "Empty icon" : "Current icon";
  const description = getCurrentIconDescription(category, removeIcon);

  return (
    <div className="category-form-current">
      <CategoryIcon category={category} />
      <div className="category-form-current-copy">
        <strong>{heading}</strong>
        <span>{description}</span>
      </div>
      {hasExistingIcon && (
        <button
          className="text-button category-icon-remove-button"
          type="button"
          disabled={busy}
          onClick={onToggleRemoval}
        >
          {removeIcon ? (
            <RotateCcw aria-hidden="true" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
          {removeIcon ? "Keep icon" : "Remove icon"}
        </button>
      )}
    </div>
  );
}

function getCurrentIconDescription(category, removeIcon) {
  if (removeIcon) return "The current icon will be removed after saving.";
  if (category.iconUrl) return "Used in category navigation.";
  return "The default clapperboard icon is being used.";
}

async function getSaveError(saveError, uploaded, pin) {
  if (!uploaded?.iconPublicId || !pin) return saveError.message;

  try {
    await cleanupCategoryIcon(uploaded.iconPublicId, pin);
    return saveError.message;
  } catch (cleanupError) {
    return `${saveError.message} The uploaded icon could not be cleaned up: ${cleanupError.message}`;
  }
}
