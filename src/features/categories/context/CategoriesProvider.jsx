import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { archiveService } from "../../../services/archive.service";
import { categoryLibraryDb } from "../services/category-library-db.service";
import { categorySyncService } from "../services/category-sync.service";

const CategoriesContext = createContext(null);
const PULL_THROTTLE_MS = 30_000;

export function CategoriesProvider({ children }) {
  const [state, setState] = useState({ categories: [], titles: [], outbox: [], syncMeta: null });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [syncError, setSyncError] = useState(null);
  const lastPull = useRef(0);
  const debounce = useRef(null);

  const refreshLocal = useCallback(async () => {
    const next = await categoryLibraryDb.hydrate();
    setState(next);
    setSyncStatus((current) => {
      if (current === "syncing" || current === "failed") return current;
      return next.outbox.length ? "saved" : "synced";
    });
    return next;
  }, []);

  const pull = useCallback(async () => {
    lastPull.current = Date.now();
    try {
      const result = await categorySyncService.pull({ pin: archiveService.getSessionPin() });
      setSyncError(null);
      const cached = await refreshLocal();
      if (result.migrationRequired) setSyncStatus("saved");
      return cached;
    } catch (error) {
      setSyncError(error);
      const cached = await refreshLocal();
      setSyncStatus("failed");
      return cached;
    }
  }, [refreshLocal]);

  const backgroundSync = useCallback(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      if (!archiveService.getSessionPin()) {
        setSyncStatus("saved");
        return;
      }
      setSyncStatus("syncing");
      try {
        await categorySyncService.syncInBackground();
        setSyncError(null);
        await refreshLocal();
        setSyncStatus("synced");
      } catch (error) {
        setSyncError(error);
        setSyncStatus("failed");
      }
    }, 600);
  }, [refreshLocal]);

  useEffect(() => {
    let active = true;
    categoryLibraryDb.hydrate()
      .then((cached) => {
        if (!active) return;
        setState(cached);
        setSyncStatus(cached.outbox.length ? "saved" : "synced");
      })
      .catch((error) => active && setSyncError(error))
      .finally(() => active && setLoading(false));
    pull();
    return () => { active = false; };
  }, [pull]);

  useEffect(() => {
    const changed = () => refreshLocal();
    const maybePull = () => {
      if (document.visibilityState === "visible" && Date.now() - lastPull.current >= PULL_THROTTLE_MS) pull();
    };
    window.addEventListener("seenetrica:categories-changed", changed);
    window.addEventListener("online", maybePull);
    document.addEventListener("visibilitychange", maybePull);
    return () => {
      window.clearTimeout(debounce.current);
      window.removeEventListener("seenetrica:categories-changed", changed);
      window.removeEventListener("online", maybePull);
      document.removeEventListener("visibilitychange", maybePull);
    };
  }, [pull, refreshLocal]);

  async function mutate(operation) {
    const result = await operation();
    await refreshLocal();
    setSyncStatus("saved");
    backgroundSync();
    return result;
  }

  async function manualSync(pin) {
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const next = await categorySyncService.sync(pin);
      setState(next);
      setSyncStatus(next.outbox.length ? "saved" : "synced");
      return next;
    } catch (error) {
      setSyncError(error);
      setSyncStatus("failed");
      throw error;
    }
  }

  const value = {
    ...state,
    loading,
    syncStatus,
    syncError,
    refreshLocal,
    pull,
    manualSync,
    createCategory: (payload) => mutate(() => categoryLibraryDb.createCategory(payload)),
    updateCategory: (id, patch) => mutate(() => categoryLibraryDb.updateCategory(id, patch)),
    createTitle: (categoryId, payload) => mutate(() => categoryLibraryDb.createTitle(categoryId, payload)),
    createTitles: (categoryId, payloads) => mutate(() => categoryLibraryDb.createTitles(categoryId, payloads)),
    updateTitle: (id, patch) => mutate(() => categoryLibraryDb.updateTitle(id, patch)),
    deleteTitle: (id) => mutate(() => categoryLibraryDb.deleteTitle(id)),
    setTitleWatched: (id, watched) => mutate(() => categoryLibraryDb.setTitleWatched(id, watched)),
  };

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error("useCategories must be used inside CategoriesProvider.");
  return value;
}
