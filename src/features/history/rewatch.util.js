export function annotateRewatchNumbers(history = []) {
  const numbered = new Array(history.length);
  const chronological = history
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const dateOrder = String(left.entry.watched_at || "").localeCompare(
        String(right.entry.watched_at || ""),
      );
      if (dateOrder) return dateOrder;
      const createdOrder = String(left.entry.created_at || "").localeCompare(
        String(right.entry.created_at || ""),
      );
      return createdOrder || left.index - right.index;
    });
  const counts = new Map();

  chronological.forEach(({ entry, index }) => {
    const movieId = String(entry.movie_id);
    const watchNumber = (counts.get(movieId) || 0) + 1;
    counts.set(movieId, watchNumber);
    numbered[index] = { ...entry, watchNumber };
  });

  return numbered;
}

export function getRewatchLabel(watchNumber) {
  if (watchNumber === 2) return "Rewatched";
  return watchNumber > 2 ? `Rewatched (${watchNumber})` : "";
}
