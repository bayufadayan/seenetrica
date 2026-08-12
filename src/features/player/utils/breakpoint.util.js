import { createSeededRandom, randomBetween } from "./seeded-random.util";

export function buildCommercialBreakpoints({ movieDurationSeconds, settings, seed }) {
  const duration = Number(movieDurationSeconds);
  const config = settings?.midRoll || settings;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Movie duration must be positive.");
  if (!config?.enabled) return [];
  const values = [
    config.intervalMinMinutes,
    config.intervalMaxMinutes,
    config.durationMinMinutes,
    config.durationMaxMinutes,
    config.firstBreakAfterMinutes,
    config.noBreakLastMinutes,
  ].map(Number);
  if (!values.every(Number.isFinite)) throw new Error("Commercial break settings are invalid.");
  const [intervalMin, intervalMax, durationMin, durationMax, firstAfter, noBreakLast] = values;
  if (intervalMin < 5 || intervalMax < intervalMin || durationMin < 1 || durationMax < durationMin) {
    throw new Error("Commercial break ranges are invalid.");
  }
  const random = createSeededRandom(seed);
  const latestAllowed = duration - noBreakLast * 60;
  let cursor = firstAfter * 60;
  const breaks = [];
  while (true) {
    cursor += Math.round(randomBetween(random, intervalMin * 60, intervalMax * 60));
    if (cursor >= latestAllowed || cursor >= duration) break;
    breaks.push({
      id: `break-${String(seed)}-${breaks.length + 1}`,
      atMovieSecond: cursor,
      targetDurationSeconds: Math.round(randomBetween(random, durationMin * 60, durationMax * 60)),
      status: "pending",
      items: [],
    });
  }
  return breaks;
}
