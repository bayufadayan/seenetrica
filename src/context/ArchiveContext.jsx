import { createContext, useContext, useEffect, useState } from "react";
import { archiveService } from "../services/archive.service";

const ArchiveContext = createContext(null);

export function ArchiveProvider({ children }) {
  const [archive, setArchive] = useState({
    movies: [],
    history: [],
    memories: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await archiveService.getArchive();
      setArchive(data);
      return data;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    archiveService
      .getArchive()
      .then((data) => active && setArchive(data))
      .catch((nextError) => active && setError(nextError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <ArchiveContext.Provider value={{ ...archive, loading, error, refresh }}>
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
