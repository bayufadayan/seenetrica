export const FALLBACK_POSTER =
  "https://placehold.co/500x750/191917/F4F0E7?text=No+Poster";

export const STORAGE_KEYS = {
  movies: "seenetrica-movies",
  history: "seenetrica-watch-history",
  memories: "seenetrica-movie-memories",
  searches: "seenetrica-search-history",
  pin: "seenetrica-session-pin",
};

export const MEMORY_TYPES = [
  ["photo", "Photo"],
  ["ticket", "Ticket"],
  ["poster", "Poster"],
  ["screenshot", "Screenshot"],
  ["other", "Other"],
];

export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);
export const ACCEPTED_MEDIA_TYPES = new Set([...IMAGE_TYPES, ...VIDEO_TYPES]);
export const MAX_MEMORY_FILES = 10;
export const MAX_MEMORY_BYTES = 15 * 1024 * 1024;
