export function buildCommercialPlan({ media = [], targetDurationSeconds, usedIds = [], random = Math.random, toleranceSeconds = 20 }) {
  const target = Math.max(1, Number(targetDurationSeconds) || 1);
  const used = new Set(usedIds);
  const candidates = media.filter((item) => item.id && Number(item.durationSeconds) > 0 && !used.has(item.id));
  const items = [];
  let duration = 0;
  while (candidates.length && duration < target) {
    const remaining = target - duration;
    const fitting = candidates.filter((item) => item.durationSeconds <= remaining + toleranceSeconds);
    if (!fitting.length) break;
    const selected = fitting[Math.floor(random() * fitting.length)];
    items.push(selected);
    duration += Number(selected.durationSeconds);
    used.add(selected.id);
    candidates.splice(candidates.findIndex((item) => item.id === selected.id), 1);
  }
  if (duration < target) {
    items.push({ id: `countdown-${items.length}`, kind: "countdown", durationSeconds: target - duration });
    duration = target;
  }
  return { items, durationSeconds: duration, usedIds: [...used] };
}

export function buildPreShowPlan(options) {
  return buildCommercialPlan({ ...options, toleranceSeconds: 10 });
}
