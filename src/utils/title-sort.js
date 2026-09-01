export const TITLE_SORT_OPTIONS = [
  { value: "release-newest", label: "Release year: Newest first" },
  { value: "release-oldest", label: "Release year: Oldest first" },
  { value: "title-ascending", label: "Title: A-Z" },
  { value: "title-descending", label: "Title: Z-A" },
  { value: "duration-longest", label: "Duration: Longest first" },
  { value: "duration-shortest", label: "Duration: Shortest first" },
];

const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function sortTitles(titles, sortOption) {
  return [...titles].sort((left, right) => {
    const comparison = compareByOption(left, right, sortOption);
    return comparison || compareTitles(left, right);
  });
}

function compareByOption(left, right, sortOption) {
  switch (sortOption) {
    case "release-oldest":
      return compareOptionalNumbers(releaseYear(left), releaseYear(right), "ascending");
    case "title-ascending":
      return compareTitles(left, right);
    case "title-descending":
      return compareTitles(right, left);
    case "duration-longest":
      return compareOptionalNumbers(runtimeMinutes(left), runtimeMinutes(right), "descending");
    case "duration-shortest":
      return compareOptionalNumbers(runtimeMinutes(left), runtimeMinutes(right), "ascending");
    case "release-newest":
    default:
      return compareOptionalNumbers(releaseYear(left), releaseYear(right), "descending");
  }
}

function compareOptionalNumbers(left, right, direction) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "ascending" ? left - right : right - left;
}

function compareTitles(left, right) {
  return titleCollator.compare(left.title || "", right.title || "");
}

function releaseYear(title) {
  const releaseDate = title.releaseDate ?? title.release_date;
  const year = Number(String(releaseDate || "").slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

function runtimeMinutes(title) {
  const duration = Number(title.runtimeMinutes ?? title.runtime_minutes);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}
