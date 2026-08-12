export function getEligibleTitles(titles) {
  const titleMap = new Map(titles.map((title) => [title.id, title]));
  return titles.filter((title) => {
    if (title.isWatched) return false;
    return (title.prerequisiteIds || []).every((id) => titleMap.get(id)?.isWatched === true);
  });
}

export function pickUniqueRecommendation(titles, seenIds = [], random = Math.random) {
  const seen = new Set(seenIds);
  const available = getEligibleTitles(titles).filter((title) => !seen.has(title.id));
  if (!available.length || seen.size >= 3) return null;
  return available[Math.floor(random() * available.length)];
}

export function buildRecommendationHistory(titles, random = Math.random, limit = 3) {
  const eligible = [...getEligibleTitles(titles)];
  const result = [];
  while (eligible.length && result.length < Math.min(3, limit)) {
    const index = Math.floor(random() * eligible.length);
    result.push(eligible.splice(index, 1)[0]);
  }
  return result;
}
