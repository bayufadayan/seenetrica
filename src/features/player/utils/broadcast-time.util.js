export function calculateScheduledStart(now, minMinutes, maxMinutes) {
  const current = now instanceof Date ? new Date(now) : new Date(now);
  const minimum = Number(minMinutes);
  const maximum = Number(maxMinutes);
  if (Number.isNaN(current.getTime())) throw new Error("A valid current time is required.");
  if (![minimum, maximum].every(Number.isFinite) || minimum < 1 || maximum < minimum) {
    throw new Error("Pre-show minimum and maximum are invalid.");
  }

  const minimumMs = minimum * 60 * 1000;
  const maximumWithToleranceMs = maximum * 60 * 1000 + 59 * 1000;
  const boundary = new Date(current);
  boundary.setMilliseconds(0);
  boundary.setSeconds(0);
  boundary.setMinutes(Math.floor(boundary.getMinutes() / 5) * 5 + 5);

  for (let attempts = 0; attempts < 12; attempts += 1) {
    const distance = boundary.getTime() - current.getTime();
    if (distance >= minimumMs && distance <= maximumWithToleranceMs) return boundary;
    boundary.setMinutes(boundary.getMinutes() + 5);
  }
  throw new Error("No five-minute broadcast boundary fits the pre-show range.");
}

export function formatBroadcastTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function secondsUntil(timestamp, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(timestamp).getTime() - Number(now)) / 1000));
}
