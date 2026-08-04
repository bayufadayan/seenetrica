import { parseJson } from "../../../services/http";

export const youtubeTrailerService = {
  async resolveChannel(channelUrl) {
    const response = await fetch(`/api/youtube/channel?${new URLSearchParams({ url: channelUrl })}`);
    return parseJson(response);
  },
  async getLatestVideos(channelId, limit = 10, force = false) {
    const params = new URLSearchParams({ channelId, limit: String(limit) });
    if (force) params.set("refresh", String(Date.now()));
    const response = await fetch(`/api/youtube/videos?${params}`);
    const result = await parseJson(response);
    return Array.isArray(result.videos) ? result.videos : [];
  },
};
