import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { archiveService } from "../../../services/archive.service";
import { categoryLibraryDb } from "../services/category-library-db.service";
import { categorySyncService } from "../services/category-sync.service";

const CategoriesContext = createContext(null);
const PULL_THROTTLE_MS = 30_000;

export function CategoriesProvider({ children }) {
  const [state, setState] = useState({ categories: [], titles: [], outbox: [], syncMeta: null });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("saved");
  const [syncError, setSyncError] = useState(null);
  const lastPull = useRef(0);
  const debounce = useRef(null);
  const serverVerified = useRef(false);

  const refreshLocal = useCallback(async () => {
    const next = await categoryLibraryDb.hydrate();
    setState(next);
    setSyncStatus((current) => {
      if (["syncing", "failed"].includes(current)) return current;
      if (next.outbox.length) return "saved";
      return serverVerified.current ? "synced" : "saved";
    });
    return next;
  }, []);

  const applyPullResult = useCallback((result) => {
    if (result.state) setState(result.state);
    serverVerified.current = true;
    setSyncStatus(result.state?.outbox?.length ? "saved" : "synced");
  }, []);

  const pull = useCallback(async () => {
    lastPull.current = Date.now();
    setSyncStatus("syncing");
    try {
      const result = await categorySyncService.pull();
      setSyncError(null);
      applyPullResult(result);
      return result;
    } catch (error) {
      serverVerified.current = false;
      setSyncError(error);
      await refreshLocal().catch(() => null);
      setSyncStatus("failed");
      throw error;
    } finally {
      // Throttle from completion, not request start; a slow failed pull should
      // not become eligible for another automatic request immediately.
      lastPull.current = Date.now();
    }
  }, [applyPullResult, refreshLocal]);

  const backgroundSync = useCallback(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      if (!archiveService.getSessionPin()) {
        setSyncStatus("saved");
        return;
      }
      setSyncStatus("syncing");
      try {
        const result = await categorySyncService.syncInBackground();
        if (result.skipped) return;
        setSyncError(null);
        applyPullResult(result.pullResult);
      } catch (error) {
        serverVerified.current = false;
        setSyncError(error);
        await refreshLocal().catch(() => null);
        setSyncStatus("failed");
      }
    }, 600);
  }, [applyPullResult, refreshLocal]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = await categoryLibraryDb.hydrate();
        if (!active) return;
        setState(cached);
        setSyncStatus("saved");
      } catch (error) {
        if (active) {
          setSyncError(error);
          setSyncStatus("failed");
        }
      } finally {
        if (active) setLoading(false);
      }
      if (!active) return;
      try {
        await pull();
      } catch {
        // Pull exposes its error through provider state.
      }
    })();
    return () => { active = false; };
  }, [pull]);

  useEffect(() => {
    const changed = () => refreshLocal().catch((error) => setSyncError(error));
    const maybePull = () => {
      if (document.visibilityState === "visible" && Date.now() - lastPull.current >= PULL_THROTTLE_MS) {
        pull().catch(() => {});
      }
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
    serverVerified.current = false;
    setSyncStatus("saved");
    backgroundSync();
    return result;
  }

  async function manualSync(pin) {
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const result = await categorySyncService.sync(pin);
      applyPullResult(result.pullResult);
      return result;
    } catch (error) {
      serverVerified.current = false;
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
