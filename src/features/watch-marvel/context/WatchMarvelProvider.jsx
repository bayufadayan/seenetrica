import { createContext, useContext, useEffect, useState } from "react";
import { watchMarvelDb } from "../services/watch-marvel-db.service";

const WatchMarvelContext = createContext(null);

export function WatchMarvelProvider({ children }) {
  const [data, setData] = useState({ titles: [], settings: null, localSource: null, youtubeChannels: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      const [titles, settings, localSource, youtubeChannels] = await Promise.all([
        watchMarvelDb.getTitles(),
        watchMarvelDb.getSettings(),
        watchMarvelDb.getLocalSource(),
        watchMarvelDb.getYouTubeChannels(),
      ]);
      const next = { titles, settings, localSource: localSource || null, youtubeChannels };
      setData(next);
      setError(null);
      return next;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      watchMarvelDb.getTitles(),
      watchMarvelDb.getSettings(),
      watchMarvelDb.getLocalSource(),
      watchMarvelDb.getYouTubeChannels(),
    ])
      .then(([titles, settings, localSource, youtubeChannels]) => {
        if (active) setData({ titles, settings, localSource: localSource || null, youtubeChannels });
      })
      .catch((nextError) => active && setError(nextError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <WatchMarvelContext.Provider value={{ ...data, loading, error, refresh }}>
      {children}
    </WatchMarvelContext.Provider>
  );
}

export function useWatchMarvel() {
  const value = useContext(WatchMarvelContext);
  if (!value) throw new Error("useWatchMarvel must be used inside WatchMarvelProvider.");
  return value;
}
