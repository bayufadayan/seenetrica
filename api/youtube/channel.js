function parseChannelReference(value) {
  const input = String(value || "").trim();
  if (!input || input.length > 200) return null;
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(input)) return { id: input };
  if (/^@[A-Za-z0-9._-]{3,}$/.test(input)) return { handle: input.slice(1) };
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["youtube.com", "m.youtube.com"].includes(host)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "channel" && /^UC[A-Za-z0-9_-]{20,}$/.test(parts[1] || "")) return { id: parts[1] };
    if (parts[0]?.startsWith("@")) return { handle: parts[0].slice(1) };
  } catch {
    return null;
  }
  return null;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return response.status(500).json({ error: "YOUTUBE_API_KEY is not configured on the server." });
  const reference = parseChannelReference(request.query.url);
  if (!reference) return response.status(400).json({ error: "Enter a valid YouTube channel URL or handle." });
  const params = new URLSearchParams({ part: "snippet", key: apiKey });
  if (reference.id) params.set("id", reference.id);
  else params.set("forHandle", reference.handle);
  try {
    const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
    const payload = await youtubeResponse.json().catch(() => ({}));
    if (!youtubeResponse.ok) return response.status(youtubeResponse.status).json({ error: payload.error?.message || "YouTube channel lookup failed." });
    const channel = payload.items?.[0];
    if (!channel) return response.status(404).json({ error: "YouTube channel was not found." });
    response.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return response.status(200).json({
      channelId: channel.id,
      title: channel.snippet?.title || "YouTube channel",
      thumbnailUrl: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || null,
    });
  } catch (error) {
    console.error("YouTube channel error:", error);
    return response.status(502).json({ error: "Could not connect to YouTube." });
  }
};
