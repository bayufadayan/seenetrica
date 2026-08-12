import { createDefaultSettings } from "../constants/player.constants";

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}

export function normalizeSettings(value) {
  const defaults = createDefaultSettings();
  const source = value && typeof value === "object" ? value : {};
  const settings = {
    ...defaults,
    ...source,
    id: "default",
    preShow: { ...defaults.preShow, ...(source.preShow || {}) },
    midRoll: { ...defaults.midRoll, ...(source.midRoll || {}) },
    player: { ...defaults.player, ...(source.player || {}) },
  };
  const preMin = finite(settings.preShow.minMinutes, "Pre-show minimum");
  const preMax = finite(settings.preShow.maxMinutes, "Pre-show maximum");
  const intervalMin = finite(settings.midRoll.intervalMinMinutes, "Break interval minimum");
  const intervalMax = finite(settings.midRoll.intervalMaxMinutes, "Break interval maximum");
  const durationMin = finite(settings.midRoll.durationMinMinutes, "Break duration minimum");
  const durationMax = finite(settings.midRoll.durationMaxMinutes, "Break duration maximum");
  const firstBreak = finite(settings.midRoll.firstBreakAfterMinutes, "First break time");
  const noBreakLast = finite(settings.midRoll.noBreakLastMinutes, "Ending protection");
  const volume = finite(settings.player.defaultVolume, "Default volume");
  if (preMin < 1 || preMin > preMax) throw new Error("Pre-show minimum must be at least one minute and not exceed its maximum.");
  if (intervalMin < 5 || intervalMin > intervalMax) throw new Error("Commercial interval minimum must be at least five minutes and not exceed its maximum.");
  if (durationMin < 1 || durationMin > durationMax) throw new Error("Commercial duration minimum must be at least one minute and not exceed its maximum.");
  if (firstBreak < 0 || noBreakLast < 0) throw new Error("Commercial timing cannot be negative.");
  if (volume < 0 || volume > 1) throw new Error("Default volume must be between 0 and 1.");
  settings.preShow.minMinutes = preMin;
  settings.preShow.maxMinutes = preMax;
  settings.midRoll.intervalMinMinutes = intervalMin;
  settings.midRoll.intervalMaxMinutes = intervalMax;
  settings.midRoll.durationMinMinutes = durationMin;
  settings.midRoll.durationMaxMinutes = durationMax;
  settings.midRoll.firstBreakAfterMinutes = firstBreak;
  settings.midRoll.noBreakLastMinutes = noBreakLast;
  settings.player.defaultVolume = volume;
  return settings;
}
