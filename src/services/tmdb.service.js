import { parseJson } from "./http";

export const tmdbService = {
  async search(query, page = 1) {
    const params = new URLSearchParams({ q: query, page: String(page) });
    const response = await fetch(`/api/tmdb/search?${params}`);
    const payload = await parseJson(response);
    return {
      results: Array.isArray(payload.results) ? payload.results : [],
      page: Number(payload.page) || page,
      totalPages: Math.max(1, Number(payload.total_pages) || 1),
    };
  },

  async getDetails(id, type) {
    const params = new URLSearchParams({ id: String(id), type });
    const response = await fetch(`/api/tmdb/details?${params}`);
    return parseJson(response);
  },
};
