const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
});
const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function validReleaseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return value;
}

export function formatReleaseDay(value) {
  const validDate = validReleaseDate(value);
  return validDate ? dayFormatter.format(new Date(`${validDate}T12:00:00`)) : "Date TBA";
}

export function groupMoviesByReleaseMonth(movies, now = new Date()) {
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const groups = new Map();

  for (const movie of movies) {
    const releaseDate = validReleaseDate(movie.release_date);
    const key = releaseDate ? releaseDate.slice(0, 7) : "tba";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(movie);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === "tba") return 1;
      if (right === "tba") return -1;
      return left.localeCompare(right);
    })
    .map(([key, items]) => ({
      key,
      label: key === "tba" ? "Release Date TBA" : monthFormatter.format(new Date(`${key}-01T12:00:00`)),
      isCurrentMonth: key === thisMonth,
      movies: [...items].sort((left, right) => {
        const dates = String(left.release_date || "").localeCompare(String(right.release_date || ""));
        if (dates) return dates;
        return titleCollator.compare(left.title || "", right.title || "") || String(left.id).localeCompare(String(right.id));
      }),
    }));
}
