import { authenticatedPost, parseJson } from "./http";
import { storage } from "../utils/storage";
import { STORAGE_KEYS } from "../utils/constants";

function readCachedArchive() {
  const movies = storage.get(STORAGE_KEYS.movies);
  const history = storage.get(STORAGE_KEYS.history);
  const memories = storage.get(STORAGE_KEYS.memories, []);
  return Array.isArray(movies) && Array.isArray(history)
    ? { movies, history, memories: Array.isArray(memories) ? memories : [] }
    : null;
}

function cacheArchive(data) {
  storage.set(STORAGE_KEYS.movies, data.movies);
  storage.set(STORAGE_KEYS.history, data.history);
  storage.set(STORAGE_KEYS.memories, data.memories);
}

function sessionPin() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.pin)?.trim() || null;
  } catch {
    return null;
  }
}

function rememberPin(pin) {
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.pin, String(pin).trim());
  } catch {
    // Saving still works when session storage is blocked.
  }
}

function forgetPin() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEYS.pin);
  } catch {
    // Storage may be blocked.
  }
}

export const archiveService = {
  async getArchive() {
    try {
      const response = await fetch("/api/data", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const result = await parseJson(response);
      const movies = result.data?.movies;
      const history = result.data?.watch_history;
      const memories = Array.isArray(result.data?.movie_memories)
        ? result.data.movie_memories
        : [];
      if (!Array.isArray(movies) || !Array.isArray(history)) {
        throw new Error("The archive returned an invalid data format.");
      }
      const archive = { movies, history, memories };
      cacheArchive(archive);
      return archive;
    } catch (error) {
      const cached = readCachedArchive();
      if (cached) {
        console.warn("Using cached Seenetrica data:", error);
        return cached;
      }
      throw error;
    }
  },

  getSessionPin: sessionPin,

  askForPin() {
    const saved = sessionPin();
    if (saved) return saved;
    const value = window.prompt(
      "Enter your Seenetrica PIN to save this change:",
    );
    if (value === null) return null;
    return value.trim() || "";
  },

  async writeAction(action, data, pin) {
    try {
      const result = await authenticatedPost(
        "/api/data",
        { action, data },
        pin,
      );
      rememberPin(pin);
      storage.remove(STORAGE_KEYS.movies);
      storage.remove(STORAGE_KEYS.history);
      storage.remove(STORAGE_KEYS.memories);
      return result;
    } catch (error) {
      if (/pin|unauthori[sz]ed|forbidden|authentication/i.test(error.message))
        forgetPin();
      throw error;
    }
  },
};
