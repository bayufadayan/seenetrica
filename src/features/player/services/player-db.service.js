import { openDB } from "idb";
import {
  PLAYER_DB_NAME,
  PLAYER_DB_VERSION,
  createDefaultSettings,
} from "../constants/player.constants";
import { normalizeSettings } from "../utils/settings.util";
import {
  createTitleIdentityKey,
  normalizeLegacyTitle,
} from "../../categories/utils/title-draft.util";

let databasePromise;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDB(PLAYER_DB_NAME, PLAYER_DB_VERSION, {
      upgrade(database, oldVersion, _newVersion, transaction) {
        const titles = database.objectStoreNames.contains("titles")
          ? transaction.objectStore("titles")
          : database.createObjectStore("titles", { keyPath: "id" });
        const indexes = [
          ["tmdbId", "tmdbId"],
          ["type", "type"],
          ["isWatched", "isWatched"],
          ["releaseDate", "releaseDate"],
          ["createdAt", "createdAt"],
          ["identityKey", "identityKey"],
          ["baseTitle", "baseTitle"],
          ["seasonNumber", "seasonNumber"],
        ];
        for (const [name, keyPath] of indexes) {
          if (!titles.indexNames.contains(name)) titles.createIndex(name, keyPath);
        }
        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "id" }).put(createDefaultSettings());
        }
        for (const storeName of ["localSources", "youtubeChannels", "sessions"]) {
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName, { keyPath: "id" });
          }
        }
        if (oldVersion < 2) {
          titles.openCursor().then(function migrate(cursor) {
            if (!cursor) return;
            cursor.update(normalizeLegacyTitle(cursor.value));
            return cursor.continue().then(migrate);
          }).catch((error) => {
            console.error("Legacy category title migration failed:", error);
            try { transaction.abort(); } catch { /* The transaction already failed. */ }
          });
        }
      },
      blocked() {
        console.warn("Player database upgrade is blocked by another tab.");
      },
      terminated() {
        databasePromise = undefined;
      },
    }).catch((error) => {
      databasePromise = undefined;
      throw new Error(`Player storage could not be opened: ${error.message}`);
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

export function normalizeTitlePayload(payload, existing = null) {
  validateTitlePayload(payload);
  const type = payload.type;
  const seasonValue = Number(payload.seasonNumber);
  const seasonNumber = type === "series" && Number.isInteger(seasonValue) && seasonValue > 0
    ? seasonValue
    : null;
  const prerequisiteIds = [...new Set(
    (Array.isArray(payload.prerequisiteIds) ? payload.prerequisiteIds : []).filter(Boolean),
  )];
  const recordId = existing?.id || id();
  const timestamp = now();
  const title = payload.title.trim();
  const baseTitle = String(payload.baseTitle || existing?.baseTitle || title).trim();
  if (!baseTitle) throw new Error("Base title is required.");
  const identityKey = existing?.identityKey || createTitleIdentityKey({
    type,
    tmdbId: payload.tmdbId,
    seasonNumber,
  });
  return {
    ...existing,
    ...payload,
    id: recordId,
    tmdbId: Number(payload.tmdbId),
    title,
    baseTitle,
    originalTitle: String(payload.originalTitle || payload.title).trim(),
    releaseDate: payload.releaseDate || null,
    type,
    seasonNumber,
    seasonTmdbId: seasonNumber && Number.isInteger(Number(payload.seasonTmdbId)) && Number(payload.seasonTmdbId) > 0
      ? Number(payload.seasonTmdbId)
      : null,
    identityKey,
    isWatched: Boolean(payload.isWatched),
    prerequisiteIds,
    posterPath: payload.posterPath || null,
    backdropPath: payload.backdropPath || null,
    runtimeMinutes: Number(payload.runtimeMinutes) > 0 ? Number(payload.runtimeMinutes) : null,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function assertUniqueIdentities(records, existingTitles = [], ignoredId = null) {
  const existingByIdentity = new Map(
    existingTitles
      .filter((title) => title.id !== ignoredId)
      .map((title) => [title.identityKey || normalizeLegacyTitle(title).identityKey, title]),
  );
  const batch = new Map();
  for (const record of records) {
    if (existingByIdentity.has(record.identityKey)) {
      throw new Error(`${record.title} is already in the legacy library.`);
    }
    if (batch.has(record.identityKey)) {
      throw new Error(`${record.title} appears more than once in this batch.`);
    }
    batch.set(record.identityKey, record);
  }
}

export function validateTitleRelationships(records, existingTitles, { requireExistingPrerequisites = false } = {}) {
  const existingIds = new Set(existingTitles.map((title) => title.id));
  const titleMap = new Map(existingTitles.map((title) => [title.id, title]));
  for (const record of records) titleMap.set(record.id, record);
  for (const record of records) {
    if (record.prerequisiteIds.includes(record.id)) throw new Error("A title cannot require itself.");
    for (const prerequisiteId of record.prerequisiteIds) {
      if (!titleMap.has(prerequisiteId) || (requireExistingPrerequisites && !existingIds.has(prerequisiteId))) {
        throw new Error("One or more prerequisites no longer exist.");
      }
      if (dependsOn(prerequisiteId, record.id, titleMap)) {
        throw new Error("This prerequisite would create a circular dependency.");
      }
    }
  }
}

async function createRecords(payloads) {
  if (!Array.isArray(payloads) || !payloads.length) throw new Error("Add at least one title before saving.");
  const database = await getDatabase();
  const transaction = database.transaction("titles", "readwrite");
  try {
    const existingTitles = await transaction.store.getAll();
    const records = payloads.map((payload) => normalizeTitlePayload(payload));
    assertUniqueIdentities(records, existingTitles);
    validateTitleRelationships(records, existingTitles, { requireExistingPrerequisites: true });
    await Promise.all(records.map((record) => transaction.store.add(record)));
    await transaction.done;
    return records;
  } catch (error) {
    try { transaction.abort(); } catch { /* The transaction already failed. */ }
    throw error;
  }
}

export const playerDb = {
  async getLegacyTitles() {
    return (await getDatabase()).getAll("titles");
  },
  async hasLegacyTitles() {
    const database = await getDatabase();
    return (await database.count("titles")) > 0;
  },
  async clearLegacyTitles() {
    const database = await getDatabase();
    const transaction = database.transaction("titles", "readwrite");
    try {
      await transaction.store.clear();
      await transaction.done;
    } catch (error) {
      try { transaction.abort(); } catch { /* The transaction already failed. */ }
      throw error;
    }
  },
  async getTitles() {
    return (await getDatabase()).getAll("titles");
  },
  async getTitle(titleId) {
    return (await getDatabase()).get("titles", titleId);
  },
  async createTitle(payload) {
    return (await createRecords([payload]))[0];
  },
  async createTitles(payloads) {
    return createRecords(payloads);
  },
  async updateTitle(titleId, payload) {
    const database = await getDatabase();
    const transaction = database.transaction("titles", "readwrite");
    try {
      const titles = await transaction.store.getAll();
      const existing = titles.find((title) => title.id === titleId);
      if (!existing) throw new Error("Legacy title was not found.");
      const record = normalizeTitlePayload({ ...existing, ...payload }, existing);
      assertUniqueIdentities([record], titles, existing.id);
      validateTitleRelationships([record], titles.filter((title) => title.id !== existing.id));
      await transaction.store.put(record);
      await transaction.done;
      return record;
    } catch (error) {
      try { transaction.abort(); } catch { /* The transaction already failed. */ }
      throw error;
    }
  },
  async getTitleDependents(titleId) {
    const titles = await (await getDatabase()).getAll("titles");
    return titles.filter((title) => title.prerequisiteIds?.includes(titleId));
  },
  async deleteTitle(titleId) {
    const database = await getDatabase();
    const transaction = database.transaction("titles", "readwrite");
    try {
      const titles = await transaction.store.getAll();
      const dependents = titles.filter((title) => title.prerequisiteIds?.includes(titleId));
      const timestamp = now();
      await Promise.all(dependents.map((title) => transaction.store.put({
        ...title,
        prerequisiteIds: title.prerequisiteIds.filter((idValue) => idValue !== titleId),
        updatedAt: timestamp,
      })));
      await transaction.store.delete(titleId);
      await transaction.done;
      return { removedPrerequisiteCount: dependents.length };
    } catch (error) {
      try { transaction.abort(); } catch { /* The transaction already failed. */ }
      throw error;
    }
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
      console.warn("Using default player settings:", error);
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
    if (typeof Blob !== "undefined" && payload.movieBlob instanceof Blob) throw new Error("Video blobs cannot be stored in player settings.");
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
    if (!existing) throw new Error("Player session was not found.");
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
