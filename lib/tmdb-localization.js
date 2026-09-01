function mediaKey(item) {
  return `${item.media_type}:${item.id}`;
}

function countryCodes(item) {
  const originCountries = Array.isArray(item?.origin_country)
    ? item.origin_country
    : [];
  const productionCountries = Array.isArray(item?.production_countries)
    ? item.production_countries.map((country) => country.iso_3166_1)
    : [];

  return new Set([...originCountries, ...productionCountries].map(String));
}

function isIndonesianProduction(item) {
  return item?.original_language === "id" || countryCodes(item).has("ID");
}

function localizedTitle(item) {
  return item?.title || item?.name || "";
}

function originalTitle(item) {
  return item?.original_title || item?.original_name || localizedTitle(item);
}

function mergeSeasons(englishSeasons, indonesianSeasons) {
  const localizedByNumber = new Map(
    (indonesianSeasons || []).map((season) => [season.season_number, season]),
  );

  return (englishSeasons || indonesianSeasons || []).map((season) => {
    const localized = localizedByNumber.get(season.season_number);
    return {
      ...season,
      name: localized?.name || season.name,
      poster_path: localized?.poster_path || season.poster_path || null,
    };
  });
}

function chooseLocalizedItem(englishItem, indonesianItem) {
  const base = englishItem || indonesianItem;
  if (!base) return null;

  const indonesian = isIndonesianProduction(englishItem)
    || isIndonesianProduction(indonesianItem);
  if (!indonesian || !indonesianItem) return base;

  return {
    ...base,
    ...indonesianItem,
    original_title: englishItem?.original_title || indonesianItem.original_title,
    original_name: englishItem?.original_name || indonesianItem.original_name,
    poster_path: indonesianItem.poster_path || englishItem?.poster_path || null,
    backdrop_path: indonesianItem.backdrop_path || englishItem?.backdrop_path || null,
    seasons: mergeSeasons(englishItem?.seasons, indonesianItem.seasons),
  };
}

function mergeLocalizedSearchResults(englishResults = [], indonesianResults = []) {
  const englishByKey = new Map(englishResults.map((item) => [mediaKey(item), item]));
  const indonesianByKey = new Map(indonesianResults.map((item) => [mediaKey(item), item]));
  const keys = [
    ...englishByKey.keys(),
    ...[...indonesianByKey.keys()].filter((key) => !englishByKey.has(key)),
  ];

  return keys.map((key) => chooseLocalizedItem(
    englishByKey.get(key),
    indonesianByKey.get(key),
  ));
}

function displayTitle(item) {
  return isIndonesianProduction(item) ? originalTitle(item) : localizedTitle(item);
}

module.exports = {
  chooseLocalizedItem,
  displayTitle,
  isIndonesianProduction,
  mergeLocalizedSearchResults,
  originalTitle,
};
