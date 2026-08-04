export const WATCH_MARVEL_DB_NAME = "seenetrica-watch-marvel";
export const WATCH_MARVEL_DB_VERSION = 1;

export const DEFAULT_WATCH_MARVEL_SETTINGS = Object.freeze({
  id: "default",
  preShow: {
    minMinutes: 6,
    maxMinutes: 10,
    useLocalAds: true,
    useYouTubeTrailers: true,
    useCountdownFallback: true,
  },
  midRoll: {
    enabled: true,
    intervalMinMinutes: 24,
    intervalMaxMinutes: 30,
    durationMinMinutes: 3,
    durationMaxMinutes: 5,
    firstBreakAfterMinutes: 20,
    noBreakLastMinutes: 15,
    useLocalAds: true,
    useYouTubeTrailers: true,
    useCountdownFallback: true,
    preventRepeatInSession: true,
  },
  player: { defaultVolume: 0.8 },
});

export const PLAYER_STATES = Object.freeze({
  INITIALIZING: "INITIALIZING",
  PRE_SHOW: "PRE_SHOW",
  STARTING_MOVIE: "STARTING_MOVIE",
  PLAYING_MOVIE: "PLAYING_MOVIE",
  STARTING_BREAK: "STARTING_BREAK",
  PLAYING_BREAK: "PLAYING_BREAK",
  RESUMING_MOVIE: "RESUMING_MOVIE",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
});

export const YOUTUBE_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const SUPPORTED_LOCAL_VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v"];
export const TEST_TIMELINE = Object.freeze({
  preShowSeconds: 20,
  firstMovieSeconds: 45,
  breakSeconds: 20,
  secondMovieSeconds: 45,
});

export function createDefaultSettings() {
  const now = new Date().toISOString();
  return {
    ...structuredClone(DEFAULT_WATCH_MARVEL_SETTINGS),
    createdAt: now,
    updatedAt: now,
  };
}
