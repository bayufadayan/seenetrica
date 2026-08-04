function durationSeconds(value) {
  const match = String(value || "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}

function isLikelyShort(item, seconds) {
  const metadata = [
    item.snippet?.title,
    item.snippet?.description,
    ...(item.snippet?.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasShortsMarker = /(^|[\s#_-])(shorts?|ytshorts|youtubeshorts)(?=$|[\s#_-])/.test(metadata);
  return seconds <= 60 || hasShortsMarker;
}

async function youtube(path, parameters, apiKey) {
  const params = new URLSearchParams({ ...parameters, key: apiKey });
  const result = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${params}`);
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw Object.assign(new Error(payload.error?.message || "YouTube request failed."), { status: result.status });
  return payload;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return response.status(500).json({ error: "YOUTUBE_API_KEY is not configured on the server." });
  const channelId = String(request.query.channelId || "").trim();
  const requestedLimit = Number(request.query.limit || 10);
  if (!/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) return response.status(400).json({ error: "A valid YouTube channel ID is required." });
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 10) return response.status(400).json({ error: "Video limit must be between 1 and 10." });
  try {
    const channel = await youtube("channels", { part: "contentDetails", id: channelId }, apiKey);
    const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return response.status(404).json({ error: "The channel uploads playlist was not found." });
    const playlist = await youtube(
      "playlistItems",
      { part: "snippet,contentDetails", playlistId: uploads, maxResults: String(Math.min(30, requestedLimit * 3)) },
      apiKey,
    );
    const ids = [...new Set((playlist.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean))];
    if (!ids.length) return response.status(200).json({ videos: [] });
    const details = await youtube("videos", { part: "snippet,contentDetails,status", id: ids.join(",") }, apiKey);
    const videos = (details.items || [])
      .filter((item) => item.status?.privacyStatus === "public" && item.status?.embeddable && item.snippet?.liveBroadcastContent === "none")
      .map((item) => ({ item, seconds: durationSeconds(item.contentDetails?.duration) }))
      .filter(({ item, seconds }) => seconds > 0 && seconds <= 240 && !isLikelyShort(item, seconds))
      .map(({ item, seconds }) => ({
        videoId: item.id,
        title: item.snippet?.title || "Trailer",
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
        publishedAt: item.snippet?.publishedAt || null,
        durationSeconds: seconds,
        embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(item.id)}?enablejsapi=1&playsinline=1&rel=0`,
      }))
      .sort((first, second) => String(second.publishedAt).localeCompare(String(first.publishedAt)))
      .slice(0, requestedLimit);
    response.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return response.status(200).json({ videos });
  } catch (error) {
    console.error("YouTube videos error:", error);
    return response.status(error.status || 502).json({ error: error.message || "Could not connect to YouTube." });
  }
};
