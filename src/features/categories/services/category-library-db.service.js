import { getCacheDatabase } from "../../../services/cache-db.service";
import { createCategorySlug, normalizeCategoryName } from "../utils/category.util";
import {
  assertUniqueCategoryIdentities,
  normalizeCategoryTitle,
  validateCategoryTitleRelationships,
} from "../utils/title-record.util";

function now() {
  return new Date().toISOString();
}

function createId(prefix) {
  return crypto.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createViewingEventId(sessionId) {
  return `category-viewing:${sessionId}`;
}

function activeRecords(records) {
  return records.filter((record) => !record.deletedAt);
}

async function queueRecord(outbox, kind, recordId) {
  const id = `${kind}:${recordId}`;
  const existing = await outbox.get(id);
  await outbox.put({
    id,
    kind,
    recordId,
    createdAt: existing?.createdAt || now(),
    updatedAt: now(),
  });
}

function mapCategoryId(record, categoryMap) {
  const mapped = categoryMap[record.categoryId] || record.categoryId;
  return { ...record, categoryId: mapped };
}

export function remapCategoryTitle(record, categoryMap, titleMap) {
  return {
    ...mapCategoryId(record, categoryMap),
    id: titleMap[record.id] || record.id,
    prerequisiteIds: (record.prerequisiteIds || []).map((id) => titleMap[id] || id),
  };
}

export function mergeCategoryRecords(serverRecords, localRecords, protectedIds, identityKey) {
  const protectedRecords = localRecords.filter((record) => protectedIds.has(record.id));
  const protectedIdentities = new Set(protectedRecords.map(identityKey));
  return [
    ...serverRecords.filter((record) => !record.deletedAt && !protectedIds.has(record.id) && !protectedIdentities.has(identityKey(record))),
    ...protectedRecords.filter((record) => !record.deletedAt),
  ];
}

async function replaceStore(store, records) {
  await store.clear();
  for (const record of records) await store.put(record);
}

export const categoryLibraryDb = {
  async readAll() {
    const database = await getCacheDatabase();
    const [categories, titles, outbox] = await Promise.all([
      database.getAll("categories"),
      database.getAll("categoryTitles"),
      database.getAll("categoryOutbox"),
    ]);
    return { categories, titles, outbox };
  },

  async hydrate() {
    const database = await getCacheDatabase();
    const [categories, titles, outbox, syncMeta] = await Promise.all([
      database.getAll("categories"),
      database.getAll("categoryTitles"),
      database.getAll("categoryOutbox"),
      database.get("syncMeta", "categorySync"),
    ]);
    return {
      categories: activeRecords(categories).sort((left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      ),
      titles: activeRecords(titles),
      outbox,
      syncMeta: syncMeta || null,
    };
  },

  async createCategory(payload) {
    const database = await getCacheDatabase();
    const transaction = database.transaction(["categories", "categoryOutbox"], "readwrite");
    try {
      const name = normalizeCategoryName(payload.name);
      const slug = payload.slug || createCategorySlug(name);
      if (!name) throw new Error("Category name is required.");
      if (!slug) throw new Error("Category name must contain a letter or number.");
      if (!payload.iconUrl || !payload.iconPublicId) throw new Error("A category icon is required.");
      const categories = await transaction.objectStore("categories").getAll();
      if (categories.some((category) => !category.deletedAt && category.slug === slug)) {
        throw new Error("A category with this slug already exists.");
      }
      const timestamp = now();
      const record = {
        id: payload.id || createId("local-category"),
        name,
        slug,
        iconUrl: payload.iconUrl,
        iconPublicId: payload.iconPublicId,
        sortOrder: Number.isFinite(Number(payload.sortOrder))
          ? Number(payload.sortOrder)
          : activeRecords(categories).length,
        legacyMigrationCompletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
      await transaction.objectStore("categories").add(record);
      await queueRecord(transaction.objectStore("categoryOutbox"), "category", record.id);
      await transaction.done;
      return record;
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction already failed. */ }
      throw error;
    }
  },

  async updateCategory(categoryId, patch) {
    const database = await getCacheDatabase();
    const transaction = database.transaction(["categories", "categoryOutbox"], "readwrite");
    try {
      const categoriesStore = transaction.objectStore("categories");
      const categories = await categoriesStore.getAll();
      const existing = categories.find((category) => category.id === categoryId && !category.deletedAt);
      if (!existing) throw new Error("Category was not found.");
      const name = normalizeCategoryName(patch.name ?? existing.name);
      const slug = patch.slug || existing.slug;
      if (categories.some((category) => category.id !== categoryId && !category.deletedAt && category.slug === slug)) {
        throw new Error("A category with this slug already exists.");
      }
      const { cleanupIconPublicId, ...recordPatch } = patch;
      const record = {
        ...existing,
        ...recordPatch,
        id: categoryId,
        name,
        slug,
        updatedAt: now(),
      };
      await categoriesStore.put(record);
      const outbox = transaction.objectStore("categoryOutbox");
      await queueRecord(outbox, "category", record.id);
      if (cleanupIconPublicId && cleanupIconPublicId !== record.iconPublicId) {
        await outbox.put({
          id: `iconCleanup:${record.id}`,
          kind: "iconCleanup",
          recordId: record.id,
          publicId: cleanupIconPublicId,
          createdAt: now(),
          updatedAt: now(),
        });
      }
      await transaction.done;
      return record;
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction already failed. */ }
      throw error;
    }
  },

  async createTitles(categoryId, payloads) {
    if (!Array.isArray(payloads) || !payloads.length) {
      throw new Error("Add at least one title before saving.");
    }
    const database = await getCacheDatabase();
    const transaction = database.transaction(["categoryTitles", "categoryOutbox"], "readwrite");
    try {
      const store = transaction.objectStore("categoryTitles");
      const titles = await store.getAll();
      const records = payloads.map((payload) => normalizeCategoryTitle(categoryId, payload));
      assertUniqueCategoryIdentities(records, titles);
      validateCategoryTitleRelationships(records, [...titles, ...records]);
      for (const record of records) {
        await store.add(record);
        await queueRecord(transaction.objectStore("categoryOutbox"), "title", record.id);
      }
      await transaction.done;
      return records;
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction already failed. */ }
      throw error;
    }
  },

  async createTitle(categoryId, payload) {
    return (await this.createTitles(categoryId, [payload]))[0];
  },

  async updateTitle(titleId, patch) {
    const database = await getCacheDatabase();
    const transaction = database.transaction(["categoryTitles", "categoryOutbox"], "readwrite");
    try {
      const store = transaction.objectStore("categoryTitles");
      const titles = await store.getAll();
      const existing = titles.find((title) => title.id === titleId && !title.deletedAt);
      if (!existing) throw new Error("Category title was not found.");
      const record = normalizeCategoryTitle(existing.categoryId, { ...existing, ...patch }, existing);
      assertUniqueCategoryIdentities([record], titles, [existing.id]);
      validateCategoryTitleRelationships([record], titles.filter((title) => title.id !== existing.id));
      await store.put(record);
      await queueRecord(transaction.objectStore("categoryOutbox"), "title", record.id);
      await transaction.done;
      return record;
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction already failed. */ }
      throw error;
    }
  },

  async setTitleWatched(titleId, isWatched) {
    return this.updateTitle(titleId, { isWatched: Boolean(isWatched) });
  },

  async deleteTitle(titleId) {
    const database = await getCacheDatabase();
    const transaction = database.transaction(["categoryTitles", "categoryOutbox"], "readwrite");
    try {
      const store = transaction.objectStore("categoryTitles");
      const titles = await store.getAll();
      const existing = titles.find((title) => title.id === titleId && !title.deletedAt);
      if (!existing) throw new Error("Category title was not found.");
      const timestamp = now();
      const deleted = { ...existing, deletedAt: timestamp, updatedAt: timestamp };
      await store.put(deleted);
      await queueRecord(transaction.objectStore("categoryOutbox"), "title", deleted.id);
      const dependents = titles.filter((title) =>
        title.categoryId === existing.categoryId
        && !title.deletedAt
        && title.prerequisiteIds?.includes(titleId),
      );
      for (const dependent of dependents) {
        const updated = {
          ...dependent,
          prerequisiteIds: dependent.prerequisiteIds.filter((id) => id !== titleId),
          updatedAt: timestamp,
        };
        await store.put(updated);
        await queueRecord(transaction.objectStore("categoryOutbox"), "title", updated.id);
      }
      await transaction.done;
      return { removedPrerequisiteCount: dependents.length };
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction already failed. */ }
      throw error;
    }
  },

  async getTitle(titleId) {
    return (await getCacheDatabase()).get("categoryTitles", titleId);
  },

  async recordCompletedViewing({ sessionId, categoryTitleId, watchedAt }) {
    const eventId = createViewingEventId(sessionId);
    const database = await getCacheDatabase();
    const transaction = database.transaction(["categoryTitles", "categoryOutbox"], "readwrite");
    try {
      const titleStore = transaction.objectStore("categoryTitles");
      const title = await titleStore.get(categoryTitleId);
      const updated = title && !title.deletedAt
        ? { ...title, isWatched: true, updatedAt: now() }
        : null;
      if (updated) {
        await titleStore.put(updated);
        await queueRecord(transaction.objectStore("categoryOutbox"), "title", title.id);
      }
      const completionId = `completion:${eventId}`;
      const outbox = transaction.objectStore("categoryOutbox");
      const existing = await outbox.get(completionId);
      if (!existing) {
        await outbox.put({
          id: completionId,
          kind: "completion",
          recordId: title.id,
          eventId,
          categoryTitleId: title.id,
          watchedAt,
          createdAt: now(),
          updatedAt: now(),
        });
      }
      await transaction.done;
      return { title: updated, eventId };
    } catch (error) {
      try { transaction.abort(); } catch { /* Transaction already failed. */ }
      throw error;
    }
  },

  async mergeServerSnapshot(snapshot) {
    const database = await getCacheDatabase();
    const transaction = database.transaction(
      ["categories", "categoryTitles", "categoryOutbox", "syncMeta"],
      "readwrite",
    );
    const categoriesStore = transaction.objectStore("categories");
    const titlesStore = transaction.objectStore("categoryTitles");
    const outbox = await transaction.objectStore("categoryOutbox").getAll();
    const localCategories = await categoriesStore.getAll();
    const localTitles = await titlesStore.getAll();
    const protectedCategories = new Set(
      outbox.filter((operation) => operation.kind === "category").map((operation) => operation.recordId),
    );
    const protectedTitles = new Set(
      outbox.filter((operation) => ["title", "completion"].includes(operation.kind)).map((operation) => operation.recordId),
    );
    const categories = mergeCategoryRecords(
      snapshot.categories,
      localCategories,
      protectedCategories,
      (record) => record.slug,
    );
    const titles = mergeCategoryRecords(
      snapshot.titles,
      localTitles,
      protectedTitles,
      (record) => `${record.categoryId}::${record.identityKey}`,
    );
    await replaceStore(categoriesStore, categories);
    await replaceStore(titlesStore, titles);
    const currentSyncMeta = await transaction.objectStore("syncMeta").get("categorySync");
    await transaction.objectStore("syncMeta").put({
      ...currentSyncMeta,
      key: "categorySync",
      lastPulledAt: now(),
      serverTime: snapshot.serverTime || null,
      legacyMarvelMigrationCompletedAt: snapshot.legacyMarvelMigrationCompletedAt || null,
    });
    await transaction.done;
    return this.hydrate();
  },

  async applyCanonicalSnapshot(snapshot, idMap = {}, completedOperationIds = []) {
    const categoryMap = idMap.categories || {};
    const titleMap = idMap.category_titles || {};
    const completed = new Set(completedOperationIds);
    const database = await getCacheDatabase();
    const transaction = database.transaction(
      ["categories", "categoryTitles", "categoryOutbox", "syncMeta"],
      "readwrite",
    );
    const categoriesStore = transaction.objectStore("categories");
    const titlesStore = transaction.objectStore("categoryTitles");
    const outboxStore = transaction.objectStore("categoryOutbox");
    const localCategories = (await categoriesStore.getAll()).map((record) => ({
      ...record,
      id: categoryMap[record.id] || record.id,
    }));
    const localTitles = (await titlesStore.getAll()).map((record) => remapCategoryTitle(record, categoryMap, titleMap));
    const remainingOutbox = [];
    for (const operation of await outboxStore.getAll()) {
      if (completed.has(operation.id)) continue;
      const mappedRecordId = titleMap[operation.recordId] || categoryMap[operation.recordId] || operation.recordId;
      remainingOutbox.push({
        ...operation,
        id: operation.kind === "completion" ? operation.id : `${operation.kind}:${mappedRecordId}`,
        recordId: mappedRecordId,
        categoryTitleId: operation.categoryTitleId
          ? titleMap[operation.categoryTitleId] || operation.categoryTitleId
          : undefined,
      });
    }
    const protectedCategories = new Set(
      remainingOutbox.filter((operation) => operation.kind === "category").map((operation) => operation.recordId),
    );
    const protectedTitles = new Set(
      remainingOutbox.filter((operation) => ["title", "completion"].includes(operation.kind)).map((operation) => operation.recordId),
    );
    const categories = mergeCategoryRecords(
      snapshot.categories,
      localCategories,
      protectedCategories,
      (record) => record.slug,
    );
    const titles = mergeCategoryRecords(
      snapshot.titles,
      localTitles,
      protectedTitles,
      (record) => `${record.categoryId}::${record.identityKey}`,
    );
    await replaceStore(categoriesStore, categories);
    await replaceStore(titlesStore, titles);
    await replaceStore(outboxStore, remainingOutbox);
    const currentSyncMeta = await transaction.objectStore("syncMeta").get("categorySync");
    await transaction.objectStore("syncMeta").put({
      ...currentSyncMeta,
      key: "categorySync",
      lastSyncedAt: now(),
      lastPulledAt: now(),
      serverTime: snapshot.serverTime || null,
      legacyMarvelMigrationCompletedAt: snapshot.legacyMarvelMigrationCompletedAt || null,
    });
    await transaction.done;
    return this.hydrate();
  },

  async completeOutboxOperation(operationId) {
    const database = await getCacheDatabase();
    const transaction = database.transaction(["categoryOutbox", "syncMeta"], "readwrite");
    await transaction.objectStore("categoryOutbox").delete(operationId);
    const syncMeta = transaction.objectStore("syncMeta");
    const current = await syncMeta.get("categorySync");
    await syncMeta.put({ ...current, key: "categorySync", lastSyncedAt: now() });
    await transaction.done;
  },

  async markLegacyBootstrapComplete() {
    await (await getCacheDatabase()).put("syncMeta", {
      key: "legacyBootstrap",
      pending: false,
      completedAt: now(),
    });
  },
};
