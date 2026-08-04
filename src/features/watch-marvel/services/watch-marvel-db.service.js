import { openDB } from "idb";
import {
  WATCH_MARVEL_DB_NAME,
  WATCH_MARVEL_DB_VERSION,
  createDefaultSettings,
} from "../constants/watch-marvel.constants";
import { normalizeSettings } from "../utils/settings.util";

let databasePromise;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDB(WATCH_MARVEL_DB_NAME, WATCH_MARVEL_DB_VERSION, {
      upgrade(database) {
        const titles = database.createObjectStore("titles", { keyPath: "id" });
        titles.createIndex("tmdbId", "tmdbId");
        titles.createIndex("type", "type");
        titles.createIndex("isWatched", "isWatched");
        titles.createIndex("releaseDate", "releaseDate");
        titles.createIndex("createdAt", "createdAt");
        database.createObjectStore("settings", { keyPath: "id" }).put(createDefaultSettings());
        database.createObjectStore("localSources", { keyPath: "id" });
        database.createObjectStore("youtubeChannels", { keyPath: "id" });
        database.createObjectStore("sessions", { keyPath: "id" });
      },
      blocked() {
        console.warn("Watch Marvel database upgrade is blocked by another tab.");
      },
      terminated() {
        databasePromise = undefined;
      },
    }).catch((error) => {
      databasePromise = undefined;
      throw new Error(`Watch Marvel storage could not be opened: ${error.message}`);
    });
  }
  return databasePromise;
}

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID?.() || `wm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function validateTitlePayload(payload) {
  if (!payload?.title?.trim()) throw new Error("Title is required.");
  if (!Number.isFinite(Number(payload.tmdbId))) throw new Error("A valid TMDB ID is required.");
  if (!["movie", "series"].includes(payload.type)) throw new Error("Type must be movie or series.");
}

function dependsOn(sourceId, targetId, titleMap, visited = new Set()) {
  if (sourceId === targetId) return true;
  if (visited.has(sourceId)) return false;
  visited.add(sourceId);
  const source = titleMap.get(sourceId);
  return (source?.prerequisiteIds || []).some((nextId) => dependsOn(nextId, targetId, titleMap, visited));
}

async function prepareTitle(payload, existing = null) {
  validateTitlePayload(payload);
  const database = await getDatabase();
  const titles = await database.getAll("titles");
  const duplicate = titles.find(
    (title) => Number(title.tmdbId) === Number(payload.tmdbId) && title.type === payload.type && title.id !== existing?.id,
  );
  if (duplicate) throw new Error("This TMDB title is already in the Marvel library.");
  const prerequisiteIds = payload.type === "series" ? [...new Set(payload.prerequisiteIds || [])] : [];
  const recordId = existing?.id || id();
  if (prerequisiteIds.includes(recordId)) throw new Error("A series cannot require itself.");
  const titleMap = new Map(titles.map((title) => [title.id, title]));
  if (existing) titleMap.set(existing.id, { ...existing, ...payload, prerequisiteIds });
  for (const prerequisiteId of prerequisiteIds) {
    if (!titleMap.has(prerequisiteId)) throw new Error("A selected prerequisite no longer exists.");
    if (dependsOn(prerequisiteId, recordId, titleMap)) throw new Error("This prerequisite would create a circular dependency.");
  }
  const timestamp = now();
  return {
    ...existing,
    ...payload,
    id: recordId,
    tmdbId: Number(payload.tmdbId),
    title: payload.title.trim(),
    originalTitle: String(payload.originalTitle || payload.title).trim(),
    releaseDate: payload.releaseDate || null,
    type: payload.type,
    isWatched: Boolean(payload.isWatched),
    prerequisiteIds,
    posterPath: payload.posterPath || null,
    backdropPath: payload.backdropPath || null,
    runtimeMinutes: Number(payload.runtimeMinutes) > 0 ? Number(payload.runtimeMinutes) : null,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export const watchMarvelDb = {
  async getTitles() {
    return (await getDatabase()).getAll("titles");
  },
  async getTitle(titleId) {
    return (await getDatabase()).get("titles", titleId);
  },
  async createTitle(payload) {
    const record = await prepareTitle(payload);
    await (await getDatabase()).add("titles", record);
    return record;
  },
  async updateTitle(titleId, payload) {
    const database = await getDatabase();
    const existing = await database.get("titles", titleId);
    if (!existing) throw new Error("Marvel title was not found.");
    const record = await prepareTitle({ ...existing, ...payload }, existing);
    await database.put("titles", record);
    return record;
  },
  async deleteTitle(titleId) {
    const database = await getDatabase();
    const titles = await database.getAll("titles");
    if (titles.some((title) => title.prerequisiteIds?.includes(titleId))) {
      throw new Error("Remove this title from other series prerequisites first.");
    }
    await database.delete("titles", titleId);
  },
  async setTitleWatched(titleId, isWatched) {
    return this.updateTitle(titleId, { isWatched: Boolean(isWatched) });
  },
  async getSettings() {
    const database = await getDatabase();
    const stored = await database.get("settings", "default");
    try {
      return normalizeSettings(stored);
    } catch (error) {
      console.warn("Using default Watch Marvel settings:", error);
      const fallback = createDefaultSettings();
      await database.put("settings", fallback);
      return fallback;
    }
  },
  async saveSettings(settings) {
    const database = await getDatabase();
    const existing = await database.get("settings", "default");
    const record = normalizeSettings({
      ...settings,
      id: "default",
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    });
    await database.put("settings", record);
    return record;
  },
  async getLocalSource() {
    return (await getDatabase()).get("localSources", "local-ads");
  },
  async saveLocalSource(source) {
    const record = { ...source, id: "local-ads" };
    await (await getDatabase()).put("localSources", record);
    return record;
  },
  async clearLocalSource() {
    await (await getDatabase()).delete("localSources", "local-ads");
  },
  async getYouTubeChannels() {
    return (await getDatabase()).getAll("youtubeChannels");
  },
  async saveYouTubeChannel(channel) {
    const timestamp = now();
    const record = {
      ...channel,
      id: channel.id || id(),
      enabled: channel.enabled !== false,
      latestVideos: channel.latestVideos || [],
      createdAt: channel.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await (await getDatabase()).put("youtubeChannels", record);
    return record;
  },
  async deleteYouTubeChannel(channelId) {
    await (await getDatabase()).delete("youtubeChannels", channelId);
  },
  async updateYouTubeChannel(channelId, patch) {
    const database = await getDatabase();
    const existing = await database.get("youtubeChannels", channelId);
    if (!existing) throw new Error("Trailer channel was not found.");
    return this.saveYouTubeChannel({ ...existing, ...patch, id: channelId });
  },
  async createSession(payload) {
    if (!["watch", "test"].includes(payload.mode)) throw new Error("Session mode must be watch or test.");
    if (typeof Blob !== "undefined" && payload.movieBlob instanceof Blob) throw new Error("Video blobs cannot be stored in Watch Marvel.");
    const timestamp = now();
    const record = {
      ...payload,
      id: payload.id || id(),
      status: payload.status || "pre_show",
      phase: payload.phase || "pre_show",
      currentMovieTime: Number(payload.currentMovieTime) || 0,
      currentBreakIndex: Number.isInteger(payload.currentBreakIndex) ? payload.currentBreakIndex : -1,
      preShowPlan: payload.preShowPlan || [],
      commercialBreaks: payload.commercialBreaks || [],
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    await (await getDatabase()).add("sessions", record);
    return record;
  },
  async getSession(sessionId) {
    return (await getDatabase()).get("sessions", sessionId);
  },
  async updateSession(sessionId, patch) {
    const database = await getDatabase();
    const existing = await database.get("sessions", sessionId);
    if (!existing) throw new Error("Watch Marvel session was not found.");
    const record = { ...existing, ...patch, id: sessionId, updatedAt: now() };
    await database.put("sessions", record);
    return record;
  },
  async completeSession(sessionId) {
    return this.updateSession(sessionId, {
      status: "completed",
      phase: "completed",
      completedAt: now(),
    });
  },
};
