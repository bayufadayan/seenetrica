import { today } from "../../../utils/formatters";

const VALID_STATUSES = ["plan", "watchlist", "watched"];
const WATCHED_INTENTS = ["watched", "theater"];

export const MANUAL_MOVIE = {
  external_source: "manual",
  external_id: null,
  title: "",
  original_title: "",
  poster_url: "",
  release_date: "",
  media_type: "movie",
  runtime_minutes: "",
};

export function getLaunchPreset(searchParams) {
  const intent = (searchParams.get("intent") || "").toLowerCase();
  const requestedStatus = (searchParams.get("status") || "").toLowerCase();
  const requestedPeriod = searchParams.get("period") || "";
  const requestedDate = searchParams.get("watched_at") || "";

  return {
    status: getInitialStatus(requestedStatus, intent),
    inTheater:
      intent === "theater" ||
      ["1", "true"].includes(searchParams.get("theater")),
    period: /^\d{4}-\d{2}$/.test(requestedPeriod) ? requestedPeriod : "",
    watchedAt: /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : "",
  };
}

export function createEmptyMovieForm(preset) {
  const currentDate = today();

  return {
    title: "",
    original_title: "",
    media_type: "movie",
    release_date: "",
    runtime_minutes: "",
    status: preset.status,
    poster_url: "",
    rating: "",
    watched_at: getInitialWatchedDate(preset, currentDate),
    watched_in_theater: preset.inTheater,
    review: "",
  };
}

export function createMovieForm(movie, preset) {
  return {
    ...createEmptyMovieForm(preset),
    title: movie.title || "",
    original_title: movie.original_title || movie.title || "",
    media_type: movie.media_type || "movie",
    release_date: movie.release_date || "",
    runtime_minutes: movie.runtime_minutes || "",
    poster_url: movie.poster_url || "",
  };
}

export function getLastDateOfMonth(period) {
  if (!period) return "";

  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return `${period}-${String(lastDay).padStart(2, "0")}`;
}

export function createMoviePayload(form, selectedMovie) {
  return {
    external_source: selectedMovie?.external_source || (selectedMovie?.external_id ? "tmdb" : "manual"),
    external_id: selectedMovie?.external_id ?? null,
    title: form.title.trim(),
    original_title: String(form.original_title || "").trim() || form.title.trim(),
    poster_url: form.poster_url.trim() || null,
    release_date: form.release_date || null,
    media_type: form.media_type,
    runtime_minutes: toOptionalNumber(form.runtime_minutes),
    status: form.status,
    rating: toOptionalNumber(form.rating),
    review: form.review.trim() || null,
    base_title: selectedMovie?.base_title || form.title.trim(),
    season_number: selectedMovie?.season_number ?? null,
    season_tmdb_id: selectedMovie?.season_tmdb_id ?? null,
    identity_key: selectedMovie?.identity_key || null,
    poster_path: selectedMovie?.poster_path || null,
    backdrop_path: selectedMovie?.backdrop_path || null,
  };
}

export function createViewingPayload(form) {
  if (form.status !== "watched") return null;

  return {
    watched_at: form.watched_at,
    watched_in_theater: form.watched_in_theater,
  };
}

export function createBatchItem(movie) {
  return {
    client_id: createClientId(),
    external_source: movie.external_source || "tmdb",
    external_id: movie.external_id ?? null,
    title: movie.title || "",
    original_title: movie.original_title || movie.title || "",
    poster_url: movie.poster_url || null,
    release_date: movie.release_date || null,
    media_type: movie.media_type || "movie",
    runtime_minutes: movie.runtime_minutes || "",
    rating: "",
    review: "",
    watched_at: "",
    watched_in_theater: false,
    base_title: movie.base_title || movie.title || "",
    season_number: movie.season_number ?? null,
    season_tmdb_id: movie.season_tmdb_id ?? null,
    identity_key: movie.identity_key || null,
    poster_path: movie.poster_path || null,
    backdrop_path: movie.backdrop_path || null,
  };
}

export function createBatchPayload(item, period) {
  return {
    movie: {
      external_source: item.external_source,
      external_id: item.external_id,
      title: item.title,
      original_title: item.original_title?.trim() || item.title,
      poster_url: item.poster_url,
      release_date: item.release_date,
      media_type: item.media_type,
      runtime_minutes: toOptionalNumber(item.runtime_minutes),
      status: "watched",
      rating: toOptionalNumber(item.rating),
      review: item.review.trim() || null,
      base_title: item.base_title || item.title,
      season_number: item.season_number ?? null,
      season_tmdb_id: item.season_tmdb_id ?? null,
      identity_key: item.identity_key || null,
      poster_path: item.poster_path || null,
      backdrop_path: item.backdrop_path || null,
    },
    viewing: {
      watched_at: item.watched_at || `${period}-01`,
      watched_in_theater: item.watched_in_theater,
    },
  };
}

export function createMovieDetailsPath(movieId, mediaResult) {
  const searchParams = new URLSearchParams();

  if (mediaResult.saved.length) {
    searchParams.set("memory_saved", String(mediaResult.saved.length));
  }
  if (mediaResult.failures.length) {
    searchParams.set("memory_failed", String(mediaResult.failures.length));
  }

  const query = searchParams.toString();
  const path = `/movies/${encodeURIComponent(movieId)}`;

  return query ? `${path}?${query}` : path;
}

function getInitialStatus(requestedStatus, intent) {
  if (VALID_STATUSES.includes(requestedStatus)) return requestedStatus;
  return WATCHED_INTENTS.includes(intent) ? "watched" : "watchlist";
}

function getInitialWatchedDate(preset, currentDate) {
  if (!preset.period) return preset.watchedAt || currentDate;
  return currentDate.startsWith(preset.period) ? currentDate : "";
}

function toOptionalNumber(value) {
  return value === "" || value === null || value === undefined
    ? null
    : Number(value);
}

function createClientId() {
  return (
    window.crypto?.randomUUID?.() ||
    `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}
