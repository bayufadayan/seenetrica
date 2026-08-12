import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import {
  LegacyMarvelMigrationModal,
  LegacyMarvelMigrationReminder,
} from "../components/LegacyMarvelMigrationModal";
import { categoryLibraryDb } from "../services/category-library-db.service";
import { categorySyncService } from "../services/category-sync.service";

const CategoriesContext = createContext(null);
const PULL_THROTTLE_MS = 30_000;
const EMPTY_MIGRATION_SUMMARY = {
  total: 0,
  movies: 0,
  series: 0,
  watched: 0,
  unwatched: 0,
  prerequisites: 0,
};

function pendingMigrationStatus(status) {
  return ["confirmation_required", "dismissed", "migrating"].includes(status);
}

export function CategoriesProvider({ children }) {
  const [state, setState] = useState({ categories: [], titles: [], outbox: [], syncMeta: null });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("saved");
  const [syncError, setSyncError] = useState(null);
  const [legacyMigration, setLegacyMigration] = useState({
    status: "checking",
    titles: [],
    summary: EMPTY_MIGRATION_SUMMARY,
    stage: null,
    error: null,
  });
  const lastPull = useRef(0);
  const debounce = useRef(null);
  const dismissedForSession = useRef(false);
  const migrationPending = useRef(false);
  const serverVerified = useRef(false);
  const toast = useToast();

  const refreshLocal = useCallback(async () => {
    const next = await categoryLibraryDb.hydrate();
    setState(next);
    setSyncStatus((current) => {
      if (["syncing", "failed", "migration-pending"].includes(current)) return current;
      if (next.outbox.length) return "saved";
      return serverVerified.current ? "synced" : "saved";
    });
    return next;
  }, []);

  const applyInspectionResult = useCallback((result) => {
    if (result.state) setState(result.state);
    migrationPending.current = Boolean(result.migrationRequired);
    serverVerified.current = Boolean(result.verified);

    if (result.migrationRequired) {
      setLegacyMigration({
        status: dismissedForSession.current ? "dismissed" : "confirmation_required",
        titles: result.legacyTitles,
        summary: result.summary,
        stage: null,
        error: null,
      });
      setSyncStatus("migration-pending");
      return;
    }

    setLegacyMigration({
      status: result.marker ? "completed" : "not_required",
      titles: [],
      summary: EMPTY_MIGRATION_SUMMARY,
      stage: null,
      error: null,
    });
    setSyncStatus(result.state?.outbox?.length ? "saved" : "synced");
  }, []);

  const pull = useCallback(async () => {
    lastPull.current = Date.now();
    setSyncStatus((current) => current === "migration-pending" ? current : "syncing");
    try {
      const result = await categorySyncService.pull();
      setSyncError(null);
      applyInspectionResult(result);
      return result;
    } catch (error) {
      setSyncError(error);
      await refreshLocal().catch(() => null);
      setSyncStatus("failed");
      setLegacyMigration((current) => current.status === "checking"
        ? { ...current, status: "inspection_failed", error }
        : current);
      throw error;
    }
  }, [applyInspectionResult, refreshLocal]);

  const backgroundSync = useCallback(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      if (!archiveService.getSessionPin()) {
        setSyncStatus(migrationPending.current ? "migration-pending" : "saved");
        return;
      }
      setSyncStatus("syncing");
      try {
        const result = await categorySyncService.syncInBackground();
        if (result.skipped) return;
        setSyncError(null);
        applyInspectionResult(result.pullResult);
      } catch (error) {
        setSyncError(error);
        await refreshLocal().catch(() => null);
        setSyncStatus("failed");
      }
    }, 600);
  }, [applyInspectionResult, refreshLocal]);

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
        // pull exposes the categorized error through provider state.
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
    setSyncStatus(migrationPending.current ? "migration-pending" : "saved");
    backgroundSync();
    return result;
  }

  const reviewLegacyMigration = useCallback(() => {
    dismissedForSession.current = false;
    setLegacyMigration((current) => pendingMigrationStatus(current.status)
      ? { ...current, status: "confirmation_required", error: null, stage: null }
      : current);
  }, []);

  const dismissLegacyMigrationForSession = useCallback(() => {
    dismissedForSession.current = true;
    migrationPending.current = true;
    serverVerified.current = false;
    setLegacyMigration((current) => ({
      ...current,
      status: "dismissed",
      stage: null,
      error: null,
    }));
    setSyncStatus("migration-pending");
  }, []);

  const confirmLegacyMarvelMigration = useCallback(async (pin) => {
    migrationPending.current = true;
    serverVerified.current = false;
    setSyncError(null);
    setSyncStatus("syncing");
    setLegacyMigration((current) => ({
      ...current,
      status: "migrating",
      stage: "checking_server",
      error: null,
    }));
    try {
      const result = await categorySyncService.confirmLegacyMarvelMigration(pin, {
        onStage(stage) {
          setLegacyMigration((current) => ({ ...current, status: "migrating", stage, error: null }));
        },
      });
      dismissedForSession.current = false;
      migrationPending.current = false;
      serverVerified.current = true;
      if (result.state) setState(result.state);
      setLegacyMigration({
        status: result.marker ? "completed" : "not_required",
        titles: [],
        summary: EMPTY_MIGRATION_SUMMARY,
        stage: null,
        error: null,
      });
      setSyncStatus(result.state?.outbox?.length ? "saved" : "synced");
      if (result.status === "already_completed") {
        toast("Marvel migration was already completed on another device.");
      } else if (result.status === "migrated") {
        toast(`${result.migratedCount} Marvel titles migrated and verified.`);
      }
      return result;
    } catch (error) {
      migrationPending.current = true;
      serverVerified.current = false;
      setSyncError(error);
      setSyncStatus("migration-pending");
      setLegacyMigration((current) => ({
        ...current,
        status: "confirmation_required",
        stage: error.stage || current.stage,
        error,
      }));
      throw error;
    }
  }, [toast]);

  async function manualSync(pin) {
    if (migrationPending.current) {
      reviewLegacyMigration();
      return { migrationPending: true };
    }
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const result = await categorySyncService.sync(pin);
      serverVerified.current = !result.migrationRequired;
      applyInspectionResult(result.pullResult);
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
    legacyMigration,
    legacyMigrationPending: pendingMigrationStatus(legacyMigration.status),
    refreshLocal,
    pull,
    manualSync,
    reviewLegacyMigration,
    dismissLegacyMigrationForSession,
    confirmLegacyMarvelMigration,
    createCategory: (payload) => mutate(() => categoryLibraryDb.createCategory(payload)),
    updateCategory: (id, patch) => mutate(() => categoryLibraryDb.updateCategory(id, patch)),
    createTitle: (categoryId, payload) => mutate(() => categoryLibraryDb.createTitle(categoryId, payload)),
    createTitles: (categoryId, payloads) => mutate(() => categoryLibraryDb.createTitles(categoryId, payloads)),
    updateTitle: (id, patch) => mutate(() => categoryLibraryDb.updateTitle(id, patch)),
    deleteTitle: (id) => mutate(() => categoryLibraryDb.deleteTitle(id)),
    setTitleWatched: (id, watched) => mutate(() => categoryLibraryDb.setTitleWatched(id, watched)),
  };

  return (
    <CategoriesContext.Provider value={value}>
      {children}
      <LegacyMarvelMigrationModal
        migration={legacyMigration}
        onConfirm={confirmLegacyMarvelMigration}
        onDismiss={dismissLegacyMigrationForSession}
      />
      <LegacyMarvelMigrationReminder
        migration={legacyMigration}
        onReview={reviewLegacyMigration}
      />
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error("useCategories must be used inside CategoriesProvider.");
  return value;
}
