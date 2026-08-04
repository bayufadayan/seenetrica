import { parseJson } from "../../../services/http";

export const youtubeTrailerService = {
  async resolveChannel(channelUrl) {
    const response = await fetch(`/api/youtube/channel?${new URLSearchParams({ url: channelUrl })}`);
    return parseJson(response);
  },
  async getLatestVideos(channelId, limit = 10) {
    const response = await fetch(`/api/youtube/videos?${new URLSearchParams({ channelId, limit: String(limit) })}`);
    const result = await parseJson(response);
    return Array.isArray(result.videos) ? result.videos : [];
  },
};
