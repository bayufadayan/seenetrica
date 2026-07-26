module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    return response.status(500).json({
      error: "TMDB_ACCESS_TOKEN is not configured on the server.",
    });
  }

  const query = String(request.query.q || "").trim();
  if (query.length < 2 || query.length > 80) {
    return response.status(400).json({
      error: "Search query must contain between 2 and 80 characters.",
    });
  }

  const pageValue = String(request.query.page || "1").trim();
  if (!/^\d+$/.test(pageValue) || Number(pageValue) < 1) {
    return response.status(400).json({
      error: "Search page must be a positive integer.",
    });
  }

  const page = Number(pageValue);
  const params = new URLSearchParams({
    query,
    include_adult: "false",
    language: "en-US",
    page: String(page),
  });

  try {
    const tmdbResponse = await fetch(
      `https://api.themoviedb.org/3/search/multi?${params}`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = await tmdbResponse.json();
    if (!tmdbResponse.ok) {
      return response.status(tmdbResponse.status).json({
        error: payload.status_message || "TMDB search request failed.",
      });
    }

    const results = (payload.results || [])
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .map((item) => ({
        external_source: "tmdb",
        external_id: item.id,
        title: item.title || item.name,
        poster_url: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
        release_date: item.release_date || item.first_air_date || null,
        media_type: item.media_type === "tv" ? "series" : "movie",
      }));

    response.setHeader(
      "Cache-Control",
      "public, s-maxage=1800, stale-while-revalidate=86400",
    );

    return response.status(200).json({
      results,
      page: Number(payload.page) || page,
      total_pages: Math.max(1, Number(payload.total_pages) || 1),
      total_results: Math.max(0, Number(payload.total_results) || 0),
    });
  } catch (error) {
    console.error("TMDB search error:", error);
    return response.status(502).json({
      error: "Could not connect to TMDB.",
    });
  }
};
