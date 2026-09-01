import { CheckCircle2, DatabaseZap } from "lucide-react";
import { useState } from "react";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import { useCategories } from "../context/CategoriesProvider";

export function CategoryMovieSyncControl({ category }) {
  const { syncCategoryToMovies } = useCategories();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const synced = Boolean(category.librarySyncedAt);

  async function sync() {
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required to sync this category.", "error");
      return;
    }

    setBusy(true);
    try {
      const result = await syncCategoryToMovies(category.id, pin);
      toast(
        `${result.migrated_count} titles linked to movies. ${result.created_movie_count} new movie records created.`,
      );
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`category-movie-sync ${synced ? "is-synced" : "needs-sync"}`}>
      <div>
        {synced ? <CheckCircle2 aria-hidden="true" /> : <DatabaseZap aria-hidden="true" />}
        <span>
          <strong>{synced ? "Synced to movies" : "Legacy category storage"}</strong>
          <small>
            {synced
              ? "This library now uses movie IDs without duplicated title data."
              : "Sync once to migrate this library into movies and category_movies."}
          </small>
        </span>
      </div>
      <button
        className={synced ? "secondary-button" : "primary-button"}
        type="button"
        disabled={busy || synced}
        onClick={sync}
      >
        {synced ? <CheckCircle2 aria-hidden="true" /> : <DatabaseZap aria-hidden="true" />}
        {busy ? "Syncing…" : synced ? "Synced" : "Sync to movies"}
      </button>
    </div>
  );
}
