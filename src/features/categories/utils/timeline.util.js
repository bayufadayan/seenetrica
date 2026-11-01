export function defaultTimelineId(categoryId) {
  return `${categoryId}:timeline:default`;
}

export function createTimeline(name, sortOrder = 0) {
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID?.() || `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, name: String(name || "").trim(), sortOrder, createdAt: timestamp, updatedAt: timestamp };
}

export function normalizeTimelines(categoryId, timelines, kind = "category") {
  if (kind !== "series") return [];
  let records = timelines;
  if (typeof records === "string") {
    try { records = JSON.parse(records); } catch { records = []; }
  }
  if (!Array.isArray(records) || !records.length) {
    return [{ id: defaultTimelineId(categoryId), name: "Unnamed", sortOrder: 0 }];
  }
  return records
    .filter((timeline) => timeline && timeline.id)
    .map((timeline, index) => ({
      id: String(timeline.id),
      name: String(timeline.name || "Unnamed").trim() || "Unnamed",
      sortOrder: Number.isFinite(Number(timeline.sortOrder ?? timeline.sort_order))
        ? Number(timeline.sortOrder ?? timeline.sort_order)
        : index,
      createdAt: timeline.createdAt || timeline.created_at || null,
      updatedAt: timeline.updatedAt || timeline.updated_at || null,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}
