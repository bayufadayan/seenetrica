import { authenticatedPost, parseJson } from "./http";
import { storage } from "../utils/storage";
import { STORAGE_KEYS } from "../utils/constants";
import { cacheDb } from "./cache-db.service";

const READ_CACHE_TTL_MS = 15_000;
const readCache = new Map();
const readRequestsInFlight = new Map();
let readQueue = Promise.resolve();

function readCacheKey(scope) {
  return scope || "full";
}

function categorizedDataFromFull(data) {
  if (
    !Array.isArray(data?.categories)
    || !Array.isArray(data?.category_titles)
    || !data?.category_sync
  ) {
    return null;
  }

  return {
    categories: data.categories,
    category_titles: data.category_titles,
    category_sync: data.category_sync,
    legacy_marvel_migration_completed_at:
      data.legacy_marvel_migration_completed_at
      || data.category_sync.legacy_marvel_migration_completed_at
      || null,
    server_time: data.server_time || data.category_sync.server_time || null,
  };
}

function cachedRead(scope) {
  const entry = readCache.get(readCacheKey(scope));
  if (!entry || Date.now() - entry.storedAt > READ_CACHE_TTL_MS) return null;
  return entry.data;
}

function rememberRead(scope, data) {
  const storedAt = Date.now();
  readCache.set(readCacheKey(scope), { data, storedAt });

  if (!scope) {
    const categorized = categorizedDataFromFull(data);
    if (categorized) readCache.set("categorized", { data: categorized, storedAt });
  }
}

function clearReadCache() {
  readCache.clear();
}

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

async function fetchDataEndpoint(scope = null) {
  const cached = cachedRead(scope);
  if (cached) return cached;

  const key = readCacheKey(scope);
  if (readRequestsInFlight.has(key)) return readRequestsInFlight.get(key);

  let request;
  request = readQueue
    .catch(() => null)
    .then(async () => {
      const queuedCache = cachedRead(scope);
      if (queuedCache) return queuedCache;

      const suffix = scope ? `?scope=${encodeURIComponent(scope)}` : "";
      const response = await fetch(`/api/data${suffix}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const result = await parseJson(response);
      const data = result.data || {};
      rememberRead(scope, data);
      return data;
    })
    .finally(() => {
      if (readRequestsInFlight.get(key) === request) {
        readRequestsInFlight.delete(key);
      }
    });

  readRequestsInFlight.set(key, request);
  readQueue = request.catch(() => null);
  return request;
}

export const archiveService = {
  clearReadCache,

  async getCachedArchive() {
    return migrateLegacyCachedArchive();
  },

  async fetchData() {
    return fetchDataEndpoint();
  },

  async fetchCategorizedData() {
    return fetchDataEndpoint("categorized");
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
      clearReadCache();
      rememberPin(pin);
      return result;
    } catch (error) {
      if (/pin|unauthori[sz]ed|forbidden|authentication/i.test(error.message))
        forgetPin();
      throw error;
    }
  },
};
