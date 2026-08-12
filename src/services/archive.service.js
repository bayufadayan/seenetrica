import { authenticatedPost, parseJson } from "./http";
import { storage } from "../utils/storage";
import { STORAGE_KEYS } from "../utils/constants";
import { cacheDb } from "./cache-db.service";

function readLegacyCachedArchive() {
  const movies = storage.get(STORAGE_KEYS.movies);
  const history = storage.get(STORAGE_KEYS.history);
  const memories = storage.get(STORAGE_KEYS.memories, []);
  return Array.isArray(movies) && Array.isArray(history)
    ? { movies, history, memories: Array.isArray(memories) ? memories : [] }
    : null;
}

async function migrateLegacyCachedArchive() {
  const existing = await cacheDb.getArchiveSnapshot();
  if (existing) {
    storage.remove(STORAGE_KEYS.movies);
    storage.remove(STORAGE_KEYS.history);
    storage.remove(STORAGE_KEYS.memories);
    return existing;
  }
  const legacy = readLegacyCachedArchive();
  if (!legacy) return null;
  await cacheDb.putArchiveSnapshot(legacy);
  storage.remove(STORAGE_KEYS.movies);
  storage.remove(STORAGE_KEYS.history);
  storage.remove(STORAGE_KEYS.memories);
  return legacy;
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
  async getCachedArchive() {
    return migrateLegacyCachedArchive();
  },

  async fetchData() {
    const response = await fetch("/api/data", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const result = await parseJson(response);
    return result.data || {};
  },

  async fetchArchive() {
    const data = await this.fetchData();
    const movies = data.movies;
    const history = data.watch_history;
    const memories = Array.isArray(data.movie_memories) ? data.movie_memories : [];
    if (!Array.isArray(movies) || !Array.isArray(history)) {
      throw new Error("The archive returned an invalid data format.");
    }
    const archive = { movies, history, memories };
    await cacheDb.putArchiveSnapshot(archive);
    return archive;
  },

  async getArchive() {
    try {
      return await this.fetchArchive();
    } catch (error) {
      const cached = await this.getCachedArchive();
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
      return result;
    } catch (error) {
      if (/pin|unauthori[sz]ed|forbidden|authentication/i.test(error.message))
        forgetPin();
      throw error;
    }
  },
};
