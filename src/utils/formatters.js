export function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function formatDate(value, options = {}) {
  if (!value) return options.fallback || "TBA";
  return new Intl.DateTimeFormat("en-US", {
    month: options.month || "short",
    day: options.day || "numeric",
    year: options.year || "numeric",
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
}

export function formatRating(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

export function formatRuntime(minutes) {
  if (!minutes) return "Runtime TBA";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

export function formatMonth(period) {
  if (!/^\d{4}-\d{2}$/.test(period || "")) return "the selected month";
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function booleanValue(value) {
  return value === true || String(value).toLowerCase() === "true";
}
