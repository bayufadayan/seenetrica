import { openDB } from "idb";

export const CACHE_DB_NAME = "seenetrica-cache";
export const CACHE_DB_VERSION = 1;

let databasePromise;

export function getCacheDatabase() {
  if (!databasePromise) {
    databasePromise = openDB(CACHE_DB_NAME, CACHE_DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("categories")) {
          const store = database.createObjectStore("categories", { keyPath: "id" });
          store.createIndex("slug", "slug", { unique: true });
        }
        if (!database.objectStoreNames.contains("categoryTitles")) {
          const store = database.createObjectStore("categoryTitles", { keyPath: "id" });
          store.createIndex("categoryId", "categoryId");
          store.createIndex("categoryIdentity", ["categoryId", "identityKey"], { unique: true });
        }
        if (!database.objectStoreNames.contains("categoryOutbox")) {
          const store = database.createObjectStore("categoryOutbox", { keyPath: "id" });
          store.createIndex("kind", "kind");
          store.createIndex("recordId", "recordId");
          store.createIndex("createdAt", "createdAt");
        }
        if (!database.objectStoreNames.contains("syncMeta")) {
          database.createObjectStore("syncMeta", { keyPath: "key" });
        }
        if (!database.objectStoreNames.contains("archiveSnapshot")) {
          database.createObjectStore("archiveSnapshot", { keyPath: "id" });
        }
      },
      blocked() {
        console.warn("Seenetrica cache upgrade is blocked by another tab.");
      },
      terminated() {
        databasePromise = undefined;
      },
    }).catch((error) => {
      databasePromise = undefined;
      throw new Error(`Seenetrica cache could not be opened: ${error.message}`);
    });
  }
  return databasePromise;
}

export const cacheDb = {
  async getArchiveSnapshot() {
    const record = await (await getCacheDatabase()).get("archiveSnapshot", "current");
    return record?.data || null;
  },

  async putArchiveSnapshot(data) {
    const record = {
      id: "current",
      data,
      cachedAt: new Date().toISOString(),
    };
    await (await getCacheDatabase()).put("archiveSnapshot", record);
    return record;
  },

  async getSyncMeta(key) {
    return (await getCacheDatabase()).get("syncMeta", key);
  },

  async putSyncMeta(key, value) {
    const record = { key, ...value };
    await (await getCacheDatabase()).put("syncMeta", record);
    return record;
  },
};

export function resetCacheDatabaseForTests() {
  databasePromise = undefined;
}
