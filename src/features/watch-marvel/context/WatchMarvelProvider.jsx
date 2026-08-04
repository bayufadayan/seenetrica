import { createContext, useContext, useEffect, useRef, useState } from "react";
import { YOUTUBE_CACHE_MAX_AGE_MS } from "../constants/watch-marvel.constants";
import { watchMarvelDb } from "../services/watch-marvel-db.service";
import { youtubeTrailerService } from "../services/youtube-trailer.service";

const WatchMarvelContext = createContext(null);

export function WatchMarvelProvider({ children }) {
  const [data, setData] = useState({ titles: [], settings: null, localSource: null, youtubeChannels: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dataRef = useRef(data);
  const refreshingChannels = useRef(new Set());
  dataRef.current = data;

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

  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    async function refreshStaleChannels() {
      const channels = dataRef.current.youtubeChannels || [];
      const stale = channels.filter((channel) => {
        const fetchedAt = new Date(channel.fetchedAt || 0).getTime();
        return channel.enabled
          && !refreshingChannels.current.has(channel.id)
          && (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt >= YOUTUBE_CACHE_MAX_AGE_MS);
      });
      await Promise.all(stale.map(async (channel) => {
        refreshingChannels.current.add(channel.id);
        try {
          const latestVideos = await youtubeTrailerService.getLatestVideos(channel.channelId);
          const updated = await watchMarvelDb.updateYouTubeChannel(channel.id, {
            latestVideos,
            fetchedAt: new Date().toISOString(),
          });
          if (active) setData((current) => ({
            ...current,
            youtubeChannels: current.youtubeChannels.map((item) => item.id === updated.id ? updated : item),
          }));
        } catch (refreshError) {
          console.warn(`Could not refresh YouTube channel ${channel.title}:`, refreshError);
        } finally {
          refreshingChannels.current.delete(channel.id);
        }
      }));
    }
    refreshStaleChannels();
    const interval = window.setInterval(refreshStaleChannels, 15 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loading]);

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
