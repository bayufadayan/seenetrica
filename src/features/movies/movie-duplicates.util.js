export function normalizeMovieTitle(title) {
  return String(title || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function countMoviesByTitle(movies) {
  const counts = new Map();

  movies.forEach((movie) => {
    const title = normalizeMovieTitle(movie.title);
    if (!title) return;
    counts.set(title, (counts.get(title) || 0) + 1);
  });

  return counts;
}
