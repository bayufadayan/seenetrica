import { createContext, useContext, useEffect, useState } from "react";
import { archiveService } from "../services/archive.service";
import { loadArchiveLocalFirst } from "./archive-load.util";

const ArchiveContext = createContext(null);

export function ArchiveProvider({ children }) {
  const [archive, setArchive] = useState({
    movies: [],
    history: [],
    memories: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);

  async function refresh() {
    const hasData = !loading || archive.movies.length > 0 || archive.history.length > 0;
    if (!hasData) setLoading(true);
    try {
      const data = await archiveService.fetchArchive();
      setArchive(data);
      setError(null);
      setStale(false);
      return data;
    } catch (nextError) {
      if (hasData) {
        setStale(true);
        return archive;
      }
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function hydrateThenRefresh() {
      let hasCache = false;
      try {
        await loadArchiveLocalFirst({
          readCache: () => archiveService.getCachedArchive(),
          fetchFresh: () => archiveService.fetchArchive(),
          onCache: (cached) => {
            hasCache = true;
            if (active) { setArchive(cached); setLoading(false); }
          },
          onFresh: (fresh) => {
            if (active) { setArchive(fresh); setError(null); setStale(false); }
          },
        });
      } catch (nextError) {
        if (!active) return;
        if (hasCache) setStale(true);
        else setError(nextError);
      } finally {
        if (active) setLoading(false);
      }
    }
    hydrateThenRefresh();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refreshFromCompletion = async () => {
      try {
        const fresh = await archiveService.fetchArchive();
        setArchive(fresh);
        setError(null);
        setStale(false);
      } catch {
        setStale(true);
      }
    };
    window.addEventListener("seenetrica:archive-refresh", refreshFromCompletion);
    return () => window.removeEventListener("seenetrica:archive-refresh", refreshFromCompletion);
  }, []);

  return (
    <ArchiveContext.Provider value={{ ...archive, loading, error, stale, refresh }}>
      {children}
    </ArchiveContext.Provider>
  );
}

export function useArchive() {
  const value = useContext(ArchiveContext);
  if (!value)
    throw new Error("useArchive must be used inside ArchiveProvider.");
  return value;
}
