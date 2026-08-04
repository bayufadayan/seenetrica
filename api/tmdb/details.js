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

  const id = String(request.query.id || "").trim();
  const type = String(request.query.type || "").trim();

  if (!/^\d+$/.test(id) || !["movie", "series"].includes(type)) {
    return response.status(400).json({
      error: "A valid TMDB id and media type are required.",
    });
  }

  const tmdbType = type === "series" ? "tv" : "movie";
  const params = new URLSearchParams({ language: "en-US" });

  try {
    const tmdbResponse = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${id}?${params}`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const item = await tmdbResponse.json();
    if (!tmdbResponse.ok) {
      return response.status(tmdbResponse.status).json({
        error: item.status_message || "TMDB detail request failed.",
      });
    }

    const posterUrl = (path) => path
      ? `https://image.tmdb.org/t/p/w500${path}`
      : null;
    const backdropUrl = item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : null;
    const seasons = type === "series" && Array.isArray(item.seasons)
      ? item.seasons
          .filter((season) => Number.isInteger(season.season_number) && season.season_number > 0)
          .sort((left, right) => left.season_number - right.season_number)
          .map((season) => ({
            id: season.id,
            season_number: season.season_number,
            name: season.name || `Season ${season.season_number}`,
            air_date: season.air_date || null,
            episode_count: Number(season.episode_count) || 0,
            poster_path: season.poster_path || null,
            poster_url: posterUrl(season.poster_path || item.poster_path),
          }))
      : [];
    const result = {
      external_source: "tmdb",
      external_id: item.id,
      title: item.title || item.name,
      original_title: item.original_title || item.original_name || item.title || item.name,
      poster_path: item.poster_path || null,
      backdrop_path: item.backdrop_path || null,
      poster_url: posterUrl(item.poster_path),
      backdrop_url: backdropUrl,
      release_date: item.release_date || item.first_air_date || null,
      media_type: type,
      runtime_minutes:
        type === "series"
          ? item.episode_run_time?.find((value) => value > 0) || null
          : item.runtime || null,
      number_of_seasons: type === "series" ? Number(item.number_of_seasons) || seasons.length : null,
      seasons,
    };

    response.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    return response.status(200).json(result);
  } catch (error) {
    console.error("TMDB details error:", error);
    return response.status(502).json({
      error: "Could not connect to TMDB.",
    });
  }
};
