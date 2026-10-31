/** Seenetrica Google Apps Script backend. */

const SPREADSHEET_ID = "13DrbCGwETbFkiXTTRkGK_V9CKsjlLFR_Ap-V6p5po8w";

const SHEET_NAMES = {
  MOVIES: "movies",
  WATCH_HISTORY: "watch_history",
  MOVIE_MEMORIES: "movie_memories",
  CATEGORIES: "categories",
  CATEGORY_TITLES: "category_titles",
  CATEGORY_MOVIES: "category_movies",
};

const INITIAL_CATEGORIES = [
  {
    id: "CAT-MARVEL",
    name: "Marvel",
    slug: "marvel",
    sort_order: 10,
  },
  {
    id: "CAT-DC",
    name: "DC",
    slug: "dc",
    sort_order: 20,
  },
  {
    id: "CAT-BOTTLE",
    name: "Bottle",
    slug: "bottle",
    sort_order: 30,
  },
];

const ALLOWED_STATUSES = [
  "plan",
  "watchlist",
  "watched",
  "unlisted",
];

const ALLOWED_MEDIA_TYPES = [
  "movie",
  "series",
];

const ALLOWED_MEMORY_TYPES = [
  "photo",
  "ticket",
  "poster",
  "screenshot",
  "other",
];

const MEMORY_HEADERS = [
  "id",
  "movie_id",
  "public_id",
  "image_url",
  "caption",
  "memory_type",
  "memory_date",
  "width",
  "height",
  "bytes",
  "sort_order",
  "created_at",
  "updated_at",
];

const CATEGORY_HEADERS = [
  "id",
  "name",
  "slug",
  "kind",
  "icon_url",
  "icon_public_id",
  "sort_order",
  "legacy_migration_completed_at",
  "library_synced_at",
  "created_at",
  "updated_at",
  "deleted_at",
];

const CATEGORY_TITLE_HEADERS = [
  "id",
  "category_id",
  "tmdb_id",
  "title",
  "base_title",
  "original_title",
  "release_date",
  "media_type",
  "season_number",
  "season_tmdb_id",
  "identity_key",
  "is_watched",
  "prerequisite_ids",
  "poster_path",
  "backdrop_path",
  "runtime_minutes",
  "movie_id",
  "sort_order",
  "note",
  "created_at",
  "updated_at",
  "deleted_at",
];

const CATEGORY_MOVIE_HEADERS = [
  "id",
  "category_id",
  "movie_id",
  "is_watched",
  "prerequisite_movie_ids",
  "sort_order",
  "note",
  "legacy_category_title_id",
  "created_at",
  "updated_at",
  "deleted_at",
];

const MOVIE_HEADERS = [
  "id",
  "external_source",
  "external_id",
  "title",
  "poster_url",
  "release_date",
  "media_type",
  "runtime_minutes",
  "status",
  "rating",
  "review",
  "created_at",
  "updated_at",
  "base_title",
  "original_title",
  "season_number",
  "season_tmdb_id",
  "identity_key",
  "backdrop_path",
  "poster_path",
];

const WATCH_HISTORY_HEADERS = [
  "id",
  "movie_id",
  "watched_at",
  "watched_in_theater",
  "created_at",
  "source_event_id",
  "category_title_id",
];

const CATEGORY_ICON_FOLDER =
  "seenetrica/categories";

const MAX_SYNC_RECORDS = 2000;

const CATEGORIZED_SCHEMA_VERSION = "3";

const READ_CACHE_SECONDS = 20;

const READ_CACHE_MAX_CHARACTERS = 70000;

const READ_CACHE_KEYS = {
  ALL: "seenetrica:data:all:v1",
  CATEGORIZED: "seenetrica:data:categorized:v1",
};

const ID_CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let spreadsheetInstance = null;

function getSpreadsheet() {
  if (!spreadsheetInstance) {
    spreadsheetInstance =
      SpreadsheetApp.openById(
        SPREADSHEET_ID,
      );
  }

  return spreadsheetInstance;
}

function getSheet(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(
    sheetName,
  );

  if (!sheet) {
    throw new Error(
      `Sheet "${sheetName}" was not found.`,
    );
  }

  return sheet;
}

function readCachedData(cacheKey) {
  try {
    const cached = CacheService
      .getScriptCache()
      .get(cacheKey);

    return cached
      ? JSON.parse(cached)
      : null;
  } catch (error) {
    console.warn(
      "Could not read the data cache:",
      error,
    );
    return null;
  }
}

function cacheReadData(cacheKey, data) {
  try {
    const serialized = JSON.stringify(data);

    if (
      serialized.length >
      READ_CACHE_MAX_CHARACTERS
    ) {
      return;
    }

    CacheService
      .getScriptCache()
      .put(
        cacheKey,
        serialized,
        READ_CACHE_SECONDS,
      );
  } catch (error) {
    console.warn(
      "Could not update the data cache:",
      error,
    );
  }
}

function invalidateReadDataCache() {
  try {
    CacheService
      .getScriptCache()
      .removeAll([
        READ_CACHE_KEYS.ALL,
        READ_CACHE_KEYS.CATEGORIZED,
      ]);
  } catch (error) {
    console.warn(
      "Could not invalidate the data cache:",
      error,
    );
  }
}

function ensureSheetWithHeaders(
  sheetName,
  requiredHeaders,
) {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    sheetName,
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      sheetName,
    );
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length,
      )
      .setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length,
      )
      .setFontWeight("bold");
    return sheet;
  }

  const headers = getHeaders(sheet);
  const missingHeaders =
    requiredHeaders.filter(
      (header) => !headers.includes(header),
    );

  if (missingHeaders.length) {
    const requiredColumns =
      headers.length + missingHeaders.length;
    const columnsToInsert =
      requiredColumns - sheet.getMaxColumns();

    if (columnsToInsert > 0) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        columnsToInsert,
      );
    }

    sheet
      .getRange(
        1,
        headers.length + 1,
        1,
        missingHeaders.length,
      )
      .setValues([missingHeaders]);
  }

  sheet.setFrozenRows(1);
  sheet
    .getRange(
      1,
      1,
      1,
      headers.length + missingHeaders.length,
    )
    .setFontWeight("bold");

  return sheet;
}

function ensureCategorizedSheets() {
  const properties = PropertiesService
    .getScriptProperties();

  if (
    properties.getProperty(
      "CATEGORIZED_SCHEMA_VERSION",
    ) === CATEGORIZED_SCHEMA_VERSION
  ) {
    return;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    if (
      properties.getProperty(
        "CATEGORIZED_SCHEMA_VERSION",
      ) === CATEGORIZED_SCHEMA_VERSION
    ) {
      return;
    }

    ensureSheetWithHeaders(
      SHEET_NAMES.CATEGORIES,
      CATEGORY_HEADERS,
    );
    ensureSheetWithHeaders(
      SHEET_NAMES.CATEGORY_TITLES,
      CATEGORY_TITLE_HEADERS,
    );
    ensureSheetWithHeaders(
      SHEET_NAMES.CATEGORY_MOVIES,
      CATEGORY_MOVIE_HEADERS,
    );
    ensureSheetWithHeaders(
      SHEET_NAMES.MOVIES,
      MOVIE_HEADERS,
    );
    ensureSheetWithHeaders(
      SHEET_NAMES.WATCH_HISTORY,
      WATCH_HISTORY_HEADERS,
    );
    ensureInitialCategories();
    properties.setProperty(
      "CATEGORIZED_SCHEMA_VERSION",
      CATEGORIZED_SCHEMA_VERSION,
    );
  } finally {
    lock.releaseLock();
  }
}

function ensureMemorySheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    SHEET_NAMES.MOVIE_MEMORIES,
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      SHEET_NAMES.MOVIE_MEMORIES,
    );

    sheet.appendRow(MEMORY_HEADERS);
    sheet.setFrozenRows(1);
    sheet
      .getRange(1, 1, 1, MEMORY_HEADERS.length)
      .setFontWeight("bold");

    return sheet;
  }

  if (sheet.getLastColumn() === 0) {
    sheet.appendRow(MEMORY_HEADERS);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const headers = getHeaders(sheet);
  const missingHeaders = MEMORY_HEADERS.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length) {
    throw new Error(
      `Sheet "${SHEET_NAMES.MOVIE_MEMORIES}" is missing columns: ${missingHeaders.join(", ")}.`,
    );
  }

  return sheet;
}

function getHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    throw new Error(
      `Sheet "${sheet.getName()}" has no headers.`,
    );
  }

  return sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map((header) => String(header).trim());
}

function formatCellValue(value, header) {
  if (value instanceof Date) {
    if (
      header === "release_date" ||
      header === "watched_at" ||
      header === "memory_date"
    ) {
      return Utilities.formatDate(
        value,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      );
    }

    return value.toISOString();
  }

  if (value === "") {
    return null;
  }

  return value;
}

function readSheet(sheetName) {
  const sheet = getSheet(sheetName);
  const rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0].map((header) =>
    String(header).trim(),
  );

  return rows
    .slice(1)
    .filter((row) =>
      row.some((cell) => cell !== ""),
    )
    .map((row) => {
      const result = {};

      headers.forEach((header, index) => {
        result[header] = formatCellValue(
          row[index],
          header,
        );
      });

      return result;
    });
}

function readOptionalSheet(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(
    sheetName,
  );

  return sheet ? readSheet(sheetName) : [];
}

function writeLegacyCategoryTitles(records) {
  const sheet = getSpreadsheet().getSheetByName(
    SHEET_NAMES.CATEGORY_TITLES,
  );

  if (!sheet) {
    if (records.length) {
      throw new Error(
        "The legacy category_titles sheet is missing.",
      );
    }
    return;
  }

  writeSheetRecords(
    SHEET_NAMES.CATEGORY_TITLES,
    records,
  );
}

function writeSheetRecords(
  sheetName,
  records,
) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const previousLastRow = sheet.getLastRow();
  const requiredLastRow = records.length + 1;

  if (requiredLastRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      requiredLastRow - sheet.getMaxRows(),
    );
  }

  if (records.length) {
    const rows = records.map((record) =>
      headers.map((header) => {
        const value = record[header];
        return value === null ||
          value === undefined
          ? ""
          : value;
      }),
    );

    sheet
      .getRange(
        2,
        1,
        rows.length,
        headers.length,
      )
      .setValues(rows);
  }

  if (previousLastRow > requiredLastRow) {
    sheet
      .getRange(
        requiredLastRow + 1,
        1,
        previousLastRow - requiredLastRow,
        headers.length,
      )
      .clearContent();
  }
}

function booleanFromCell(value) {
  return value === true ||
    String(value).toLowerCase() === "true";
}

function arrayFromCell(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.filter(Boolean)
      : [];
  } catch (error) {
    console.warn(
      "Could not parse a stored ID list:",
      error,
    );
    return [];
  }
}

function isNewerTimestamp(
  incomingValue,
  storedValue,
) {
  const incoming = Date.parse(
    incomingValue || 0,
  );
  const stored = Date.parse(
    storedValue || 0,
  );

  if (!Number.isFinite(incoming)) {
    return false;
  }

  return !Number.isFinite(stored) ||
    incoming > stored;
}

function normalizeSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+films?$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || slug.length > 80) {
    throw new Error(
      "Category slug is invalid.",
    );
  }

  return slug;
}

function normalizeCategoryName(value) {
  const name = requiredText(
    String(value || "")
      .replace(/\s+films?$/i, ""),
    "Category name",
    80,
  );

  return name;
}

function ensureInitialCategories() {
  const categories = readSheet(
    SHEET_NAMES.CATEGORIES,
  );
  const ids = new Set(
    categories.map((category) =>
      String(category.id),
    ),
  );
  const slugs = new Set(
    categories.map((category) =>
      String(category.slug),
    ),
  );
  const timestamp = nowString();

  INITIAL_CATEGORIES.forEach((category) => {
    if (
      ids.has(category.id) ||
      slugs.has(category.slug)
    ) {
      return;
    }

    appendRecord(
      SHEET_NAMES.CATEGORIES,
      {
        ...category,
        icon_url: null,
        icon_public_id: null,
        legacy_migration_completed_at: null,
        library_synced_at: null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      },
    );
  });
}

function appendRecord(sheetName, record) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);

  const row = headers.map((header) => {
    const value = record[header];

    return value === null ||
      value === undefined
      ? ""
      : value;
  });

  sheet.appendRow(row);
}

function findRowNumberById(sheet, id) {
  const headers = getHeaders(sheet);
  const idColumnIndex = headers.indexOf("id");

  if (idColumnIndex === -1) {
    throw new Error(
      `Sheet "${sheet.getName()}" has no id column.`,
    );
  }

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return null;
  }

  const ids = sheet
    .getRange(
      2,
      idColumnIndex + 1,
      lastRow - 1,
      1,
    )
    .getValues();

  const index = ids.findIndex(
    (row) => String(row[0]) === String(id),
  );

  return index === -1 ? null : index + 2;
}

function updateRecord(
  sheetName,
  id,
  record,
) {
  const sheet = getSheet(sheetName);
  const rowNumber = findRowNumberById(
    sheet,
    id,
  );

  if (!rowNumber) {
    throw new Error(
      `Record "${id}" was not found.`,
    );
  }

  const headers = getHeaders(sheet);
  const row = headers.map((header) => {
    const value = record[header];

    return value === null ||
      value === undefined
      ? ""
      : value;
  });

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      headers.length,
    )
    .setValues([row]);
}

function getRecordById(sheetName, id) {
  return (
    readSheet(sheetName).find(
      (record) =>
        String(record.id) === String(id),
    ) || null
  );
}

function randomPair() {
  let result = "";

  for (let index = 0; index < 2; index += 1) {
    result += ID_CHARACTERS.charAt(
      Math.floor(
        Math.random() *
          ID_CHARACTERS.length,
      ),
    );
  }

  return result;
}

function dateStamp(date = new Date()) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyyMMdd",
  );
}

function createUniqueId(
  sheetName,
  prefix,
) {
  for (
    let attempt = 0;
    attempt < 20;
    attempt += 1
  ) {
    const id =
      `${prefix}-${dateStamp()}-${randomPair()}`;

    if (!getRecordById(sheetName, id)) {
      return id;
    }
  }

  throw new Error(
    "Could not generate a unique ID.",
  );
}

function todayString() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
}

function nowString() {
  return new Date().toISOString();
}

function requiredText(
  value,
  fieldName,
  maxLength,
) {
  const result = String(value || "").trim();

  if (!result) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  if (result.length > maxLength) {
    throw new Error(
      `${fieldName} is too long.`,
    );
  }

  return result;
}

function optionalText(
  value,
  fieldName,
  maxLength,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const result = String(value).trim();

  if (!result) {
    return null;
  }

  if (result.length > maxLength) {
    throw new Error(
      `${fieldName} is too long.`,
    );
  }

  return result;
}

function optionalNumber(
  value,
  fieldName,
  options = {},
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(
      `${fieldName} must be a number.`,
    );
  }

  if (
    options.min !== undefined &&
    number < options.min
  ) {
    throw new Error(
      `${fieldName} is below the minimum value.`,
    );
  }

  if (
    options.max !== undefined &&
    number > options.max
  ) {
    throw new Error(
      `${fieldName} exceeds the maximum value.`,
    );
  }

  return number;
}

function optionalDate(
  value,
  fieldName,
) {
  if (!value) {
    return null;
  }

  const result = String(value).slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result)
  ) {
    throw new Error(
      `${fieldName} must use YYYY-MM-DD format.`,
    );
  }

  return result;
}

function normalizeMovieInput(input) {
  const externalSource =
    input.external_source === "tmdb"
      ? "tmdb"
      : "manual";

  const mediaType = String(
    input.media_type || "",
  );

  const status = String(
    input.status || "",
  );

  if (
    !ALLOWED_MEDIA_TYPES.includes(mediaType)
  ) {
    throw new Error(
      "Invalid media type.",
    );
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(
      "Invalid movie status.",
    );
  }

  const externalId =
    externalSource === "tmdb"
      ? optionalNumber(
          input.external_id,
          "External ID",
          { min: 1 },
        )
      : null;

  if (
    externalSource === "tmdb" &&
    externalId === null
  ) {
    throw new Error(
      "TMDB entries require an external ID.",
    );
  }

  const title = requiredText(
    input.title,
    "Title",
    200,
  );
  const rawSeasonNumber = optionalNumber(
    input.season_number,
    "Season number",
    { min: 1, max: 10000 },
  );
  const seasonNumber =
    mediaType === "series" &&
    Number.isInteger(rawSeasonNumber)
      ? rawSeasonNumber
      : null;
  const seasonTmdbId = seasonNumber
    ? optionalNumber(
        input.season_tmdb_id,
        "Season TMDB ID",
        { min: 1 },
      )
    : null;
  const identityKey = externalId
    ? createCategoryTitleIdentityKey(
        mediaType,
        externalId,
        seasonNumber,
      )
    : optionalText(
        input.identity_key,
        "Identity key",
        300,
      );

  return {
    external_source: externalSource,
    external_id: externalId,
    title,
    poster_url: optionalText(
      input.poster_url,
      "Poster URL",
      2000,
    ),
    release_date: optionalDate(
      input.release_date,
      "Release date",
    ),
    media_type: mediaType,
    runtime_minutes: optionalNumber(
      input.runtime_minutes,
      "Runtime",
      {
        min: 1,
        max: 10000,
      },
    ),
    status,
    rating: optionalNumber(
      input.rating,
      "Rating",
      {
        min: 0,
        max: 10,
      },
    ),
    review: optionalText(
      input.review,
      "Review",
      20000,
    ),
    base_title:
      optionalText(
        input.base_title,
        "Base title",
        200,
      ) || title,
    original_title:
      optionalText(
        input.original_title,
        "Original title",
        200,
      ) || title,
    season_number: seasonNumber,
    season_tmdb_id: seasonTmdbId,
    identity_key: identityKey,
    backdrop_path: optionalText(
      input.backdrop_path,
      "Backdrop path",
      1000,
    ),
    poster_path: optionalText(
      input.poster_path,
      "Poster path",
      1000,
    ),
  };
}

function normalizeViewingInput(input) {
  return {
    movie_id: requiredText(
      input.movie_id,
      "Movie ID",
      50,
    ),
    watched_at:
      optionalDate(
        input.watched_at,
        "Watched date",
      ) || todayString(),
    watched_in_theater:
      input.watched_in_theater === true,
  };
}

function normalizeMemoryInput(input) {
  const movieId = requiredText(
    input.movie_id,
    "Movie ID",
    50,
  );

  const publicId = requiredText(
    input.public_id,
    "Cloudinary public ID",
    500,
  );

  const expectedPrefix =
    `seenetrica/memories/${movieId}/`;

  if (!publicId.startsWith(expectedPrefix)) {
    throw new Error(
      "The Cloudinary asset does not belong to this movie.",
    );
  }

  const imageUrl = requiredText(
    input.image_url,
    "Image URL",
    2000,
  );

  if (
    !/^https:\/\/res\.cloudinary\.com\//i.test(
      imageUrl,
    )
  ) {
    throw new Error(
      "Memory images must use a Cloudinary HTTPS URL.",
    );
  }

  const memoryType = String(
    input.memory_type || "photo",
  );

  if (
    !ALLOWED_MEMORY_TYPES.includes(
      memoryType,
    )
  ) {
    throw new Error(
      "Invalid memory type.",
    );
  }

  return {
    movie_id: movieId,
    public_id: publicId,
    image_url: imageUrl,
    caption: optionalText(
      input.caption,
      "Caption",
      1000,
    ),
    memory_type: memoryType,
    memory_date: optionalDate(
      input.memory_date,
      "Memory date",
    ),
    width: optionalNumber(
      input.width,
      "Image width",
      { min: 1, max: 20000 },
    ),
    height: optionalNumber(
      input.height,
      "Image height",
      { min: 1, max: 20000 },
    ),
    bytes: optionalNumber(
      input.bytes,
      "Image size",
      { min: 1, max: 50000000 },
    ),
    sort_order:
      optionalNumber(
        input.sort_order,
        "Sort order",
        { min: 0, max: 100000 },
      ) || 0,
  };
}

function optionalTimestamp(
  value,
  fieldName,
) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(
      `${fieldName} must be a valid timestamp.`,
    );
  }

  return parsed.toISOString();
}

function createCategoryTitleIdentityKey(
  mediaType,
  tmdbId,
  seasonNumber,
) {
  if (mediaType === "movie") {
    return `movie:${tmdbId}`;
  }

  return seasonNumber
    ? `series:${tmdbId}:season:${seasonNumber}`
    : `series:${tmdbId}:whole`;
}

function normalizeCategoryInput(
  input,
  existing,
) {
  const source = {
    ...(existing || {}),
    ...(input || {}),
  };
  const timestamp = nowString();
  const id = requiredText(
    source.id,
    "Category ID",
    100,
  );
  const name = normalizeCategoryName(
    source.name,
  );
  const slug = normalizeSlug(
    source.slug || name,
  );
  const iconUrl = optionalText(
    source.icon_url !== undefined
      ? source.icon_url
      : source.iconUrl,
    "Category icon URL",
    2000,
  );
  const iconPublicId = optionalText(
    source.icon_public_id !== undefined
      ? source.icon_public_id
      : source.iconPublicId,
    "Category icon public ID",
    500,
  );

  if (iconUrl || iconPublicId) {
    if (
      !iconUrl ||
      !iconPublicId ||
      !/^https:\/\/res\.cloudinary\.com\//i.test(
        iconUrl,
      ) ||
      !iconPublicId.startsWith(
        `${CATEGORY_ICON_FOLDER}/`,
      )
    ) {
      throw new Error(
        "Category icons must be uploaded to the Seenetrica Cloudinary folder.",
      );
    }
  }

  return {
    id,
    name,
    slug,
    kind: source.kind === "series" ? "series" : "category",
    icon_url: iconUrl,
    icon_public_id: iconPublicId,
    sort_order:
      optionalNumber(
        source.sort_order !== undefined
          ? source.sort_order
          : source.sortOrder,
        "Category sort order",
        { min: 0, max: 100000 },
      ) || 0,
    legacy_migration_completed_at:
      optionalTimestamp(
        source.legacy_migration_completed_at !==
          undefined
          ? source.legacy_migration_completed_at
          : source.legacyMigrationCompletedAt,
        "Legacy migration completion",
      ),
    library_synced_at:
      optionalTimestamp(
        source.library_synced_at !== undefined
          ? source.library_synced_at
          : source.librarySyncedAt,
        "Category library sync time",
      ),
    created_at:
      optionalTimestamp(
        source.created_at || source.createdAt,
        "Category creation time",
      ) || timestamp,
    updated_at:
      optionalTimestamp(
        source.updated_at || source.updatedAt,
        "Category update time",
      ) || timestamp,
    deleted_at: optionalTimestamp(
      source.deleted_at || source.deletedAt,
      "Category deletion time",
    ),
  };
}

function normalizeCategoryTitleInput(
  input,
  existing,
  forcedCategoryId,
) {
  const source = {
    ...(existing || {}),
    ...(input || {}),
  };
  const timestamp = nowString();
  const id = requiredText(
    source.id,
    "Category title ID",
    100,
  );
  const categoryId = requiredText(
    forcedCategoryId ||
      source.category_id ||
      source.categoryId,
    "Category ID",
    100,
  );
  const mediaType = String(
    source.media_type ||
      source.type ||
      "",
  );

  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    throw new Error(
      "Category title type must be movie or series.",
    );
  }

  const movieId = optionalText(
    source.movie_id !== undefined
      ? source.movie_id
      : source.movieId,
    "Movie ID",
    50,
  );
  const tmdbId = optionalNumber(
    source.tmdb_id !== undefined
      ? source.tmdb_id
      : source.tmdbId,
    "TMDB ID",
    { min: 1 },
  );

  if (tmdbId === null && !movieId) {
    throw new Error(
      "A valid TMDB ID is required.",
    );
  }

  const rawSeasonNumber = optionalNumber(
    source.season_number !== undefined
      ? source.season_number
      : source.seasonNumber,
    "Season number",
    { min: 1, max: 10000 },
  );
  const seasonNumber =
    mediaType === "series" &&
    Number.isInteger(rawSeasonNumber)
      ? rawSeasonNumber
      : null;
  const seasonTmdbId = seasonNumber
    ? optionalNumber(
        source.season_tmdb_id !== undefined
          ? source.season_tmdb_id
          : source.seasonTmdbId,
        "Season TMDB ID",
        { min: 1 },
      )
    : null;
  const title = requiredText(
    source.title,
    "Title",
    200,
  );
  const baseTitle = requiredText(
    source.base_title ||
      source.baseTitle ||
      title,
    "Base title",
    200,
  );
  const prerequisiteIds = [
    ...new Set(
      arrayFromCell(
        source.prerequisite_ids !== undefined
          ? source.prerequisite_ids
          : source.prerequisiteIds,
      ).map((value) =>
        requiredText(
          value,
          "Prerequisite ID",
          100,
        ),
      ),
    ),
  ];
  const identityKey = movieId
    ? `archive:${movieId}`
    : createCategoryTitleIdentityKey(
      mediaType,
      tmdbId,
      seasonNumber,
    );

  return {
    id,
    category_id: categoryId,
    tmdb_id: tmdbId,
    title,
    base_title: baseTitle,
    original_title:
      optionalText(
        source.original_title !== undefined
          ? source.original_title
          : source.originalTitle,
        "Original title",
        200,
      ) || title,
    release_date: optionalDate(
      source.release_date !== undefined
        ? source.release_date
        : source.releaseDate,
      "Release date",
    ),
    media_type: mediaType,
    season_number: seasonNumber,
    season_tmdb_id: seasonTmdbId,
    identity_key: identityKey,
    is_watched: booleanFromCell(
      source.is_watched !== undefined
        ? source.is_watched
        : source.isWatched,
    ),
    prerequisite_ids:
      JSON.stringify(prerequisiteIds),
    poster_path: optionalText(
      source.poster_path !== undefined
        ? source.poster_path
        : source.posterPath,
      "Poster path",
      1000,
    ),
    backdrop_path: optionalText(
      source.backdrop_path !== undefined
        ? source.backdrop_path
        : source.backdropPath,
      "Backdrop path",
      1000,
    ),
    runtime_minutes: optionalNumber(
      source.runtime_minutes !== undefined
        ? source.runtime_minutes
        : source.runtimeMinutes,
      "Runtime",
      { min: 1, max: 10000 },
    ),
    movie_id: movieId,
    sort_order:
      optionalNumber(
        source.sort_order !== undefined
          ? source.sort_order
          : source.sortOrder,
        "Series order",
        { min: 0, max: 100000 },
      ) || 0,
    note: optionalText(
      source.note,
      "Series note",
      5000,
    ) || "",
    created_at:
      optionalTimestamp(
        source.created_at || source.createdAt,
        "Title creation time",
      ) || timestamp,
    updated_at:
      optionalTimestamp(
        source.updated_at || source.updatedAt,
        "Title update time",
      ) || timestamp,
    deleted_at: optionalTimestamp(
      source.deleted_at || source.deletedAt,
      "Title deletion time",
    ),
  };
}

function categoryTitleForClient(record) {
  return {
    ...record,
    tmdb_id: record.tmdb_id ? Number(record.tmdb_id) : null,
    season_number:
      record.season_number === null ||
      record.season_number === ""
        ? null
        : Number(record.season_number),
    season_tmdb_id:
      record.season_tmdb_id === null ||
      record.season_tmdb_id === ""
        ? null
        : Number(record.season_tmdb_id),
    runtime_minutes:
      record.runtime_minutes === null ||
      record.runtime_minutes === ""
        ? null
        : Number(record.runtime_minutes),
    is_watched: booleanFromCell(
      record.is_watched,
    ),
    prerequisite_ids: arrayFromCell(
      record.prerequisite_ids,
    ),
  };
}

function categoryMovieForClient(
  membership,
  movie,
  membershipIdByMovieId,
) {
  return {
    id: membership.id,
    category_id: membership.category_id,
    tmdb_id: movie.external_id ? Number(movie.external_id) : null,
    title: movie.title,
    base_title:
      movie.base_title || movie.title,
    original_title:
      movie.original_title || movie.title,
    release_date:
      movie.release_date || null,
    media_type: movie.media_type,
    season_number:
      movie.season_number || null,
    season_tmdb_id:
      movie.season_tmdb_id || null,
    identity_key: movie.identity_key || `archive:${movie.id}`,
    is_watched: booleanFromCell(
      membership.is_watched,
    ),
    movie_id: String(movie.id),
    sort_order: Number(membership.sort_order) || 0,
    note: membership.note || "",
    prerequisite_ids: arrayFromCell(
      membership.prerequisite_movie_ids,
    )
      .map((movieId) =>
        membershipIdByMovieId.get(
          String(movieId),
        ),
      )
      .filter(Boolean),
    poster_path:
      movie.poster_path ||
      movie.poster_url || null,
    backdrop_path:
      movie.backdrop_path || null,
    runtime_minutes:
      movie.runtime_minutes || null,
    created_at:
      membership.created_at || null,
    updated_at:
      membership.updated_at || null,
    deleted_at:
      membership.deleted_at || null,
  };
}

function buildSyncedCategoryTitles(
  categories,
  memberships,
  movies,
) {
  const syncedCategoryIds = new Set(
    categories
      .filter((category) =>
        category.library_synced_at,
      )
      .map((category) =>
        String(category.id),
      ),
  );
  const movieById = new Map(
    movies.map((movie) => [
      String(movie.id),
      movie,
    ]),
  );
  const membershipsByCategory = new Map();

  memberships.forEach((membership) => {
    const categoryId = String(
      membership.category_id,
    );

    if (!syncedCategoryIds.has(categoryId)) {
      return;
    }

    if (!membershipsByCategory.has(categoryId)) {
      membershipsByCategory.set(categoryId, []);
    }

    membershipsByCategory
      .get(categoryId)
      .push(membership);
  });

  const result = [];

  membershipsByCategory.forEach(
    (categoryMemberships) => {
      const membershipIdByMovieId = new Map(
        categoryMemberships.map((membership) => [
          String(membership.movie_id),
          membership.id,
        ]),
      );

      categoryMemberships.forEach((membership) => {
        const movie = movieById.get(
          String(membership.movie_id),
        );

        if (!movie) {
          return;
        }

        result.push(
          categoryMovieForClient(
            membership,
            movie,
            membershipIdByMovieId,
          ),
        );
      });
    },
  );

  return result;
}

function buildCategorizedSnapshot() {
  const categories = readSheet(
    SHEET_NAMES.CATEGORIES,
  ).map((category) => ({
    ...category,
    sort_order:
      Number(category.sort_order) || 0,
  }));
  const legacyTitles = readOptionalSheet(
    SHEET_NAMES.CATEGORY_TITLES,
  ).map(categoryTitleForClient);
  const memberships = readSheet(
    SHEET_NAMES.CATEGORY_MOVIES,
  );
  const movies = readSheet(
    SHEET_NAMES.MOVIES,
  );
  const syncedCategoryIds = new Set(
    categories
      .filter((category) =>
        category.library_synced_at,
      )
      .map((category) =>
        String(category.id),
      ),
  );
  const titles = [
    ...legacyTitles.filter(
      (title) =>
        !syncedCategoryIds.has(
          String(title.category_id),
        ),
    ),
    ...buildSyncedCategoryTitles(
      categories,
      memberships,
      movies,
    ),
  ];
  const marvel = categories.find(
    (category) =>
      String(category.id) === "CAT-MARVEL" ||
      String(category.slug) === "marvel",
  );
  const migrationCompletedAt = marvel
    ? marvel.legacy_migration_completed_at ||
      null
    : null;
  const serverTime = nowString();

  return {
    categories,
    category_titles: titles,
    legacy_marvel_migration_completed_at:
      migrationCompletedAt,
    server_time: serverTime,
    category_sync: {
      legacy_marvel_migration_completed_at:
        migrationCompletedAt,
      synced_category_ids:
        Array.from(syncedCategoryIds),
      server_time: serverTime,
    },
  };
}

function validateTitleRelationships(
  titles,
  categories,
) {
  const active = titles.filter(
    (title) => !title.deleted_at,
  );
  const activeCategoryIds = new Set(
    categories
      .filter((category) =>
        !category.deleted_at,
      )
      .map((category) =>
        String(category.id),
      ),
  );
  const byId = new Map(
    active.map((title) => [
      String(title.id),
      title,
    ]),
  );

  active.forEach((title) => {
    if (
      !activeCategoryIds.has(
        String(title.category_id),
      )
    ) {
      throw new Error(
        `The category for "${title.title}" does not exist.`,
      );
    }

    const prerequisiteIds = arrayFromCell(
      title.prerequisite_ids,
    );

    prerequisiteIds.forEach((id) => {
      const prerequisite = byId.get(
        String(id),
      );

      if (
        !prerequisite ||
        String(prerequisite.category_id) !==
          String(title.category_id)
      ) {
        throw new Error(
          `A prerequisite for "${title.title}" is missing or belongs to another category.`,
        );
      }
    });
  });

  function visit(id, visiting, visited) {
    if (visiting.has(id)) {
      throw new Error(
        "Category title prerequisites contain a circular dependency.",
      );
    }

    if (visited.has(id)) {
      return;
    }

    const title = byId.get(id);

    if (!title) {
      return;
    }

    visiting.add(id);
    arrayFromCell(
      title.prerequisite_ids,
    ).forEach((nextId) =>
      visit(
        String(nextId),
        visiting,
        visited,
      ),
    );
    visiting.delete(id);
    visited.add(id);
  }

  const visited = new Set();
  active.forEach((title) =>
    visit(
      String(title.id),
      new Set(),
      visited,
    ),
  );
}

function mergeLegacyCategorizedChangesUnlocked(
  payload,
) {
  const categoryChanges = Array.isArray(
    payload.categories,
  )
    ? payload.categories
    : [];
  const titleChanges = Array.isArray(
    payload.category_titles,
  )
    ? payload.category_titles
    : [];

  if (
    categoryChanges.length > MAX_SYNC_RECORDS ||
    titleChanges.length > MAX_SYNC_RECORDS
  ) {
    throw new Error(
      "The sync batch is too large.",
    );
  }

  const categories = readSheet(
    SHEET_NAMES.CATEGORIES,
  );
  const titles = readOptionalSheet(
    SHEET_NAMES.CATEGORY_TITLES,
  );
  const categoryIdMap = {};
  const titleIdMap = {};
  const categoryIndexById = new Map(
    categories.map((category, index) => [
      String(category.id),
      index,
    ]),
  );
  const categoryIndexBySlug = new Map(
    categories.map((category, index) => [
      String(category.slug),
      index,
    ]),
  );

  categoryChanges.forEach((change) => {
    const normalized = normalizeCategoryInput(
      change,
      null,
    );
    const incomingId = String(normalized.id);
    let index = categoryIndexById.has(incomingId)
      ? categoryIndexById.get(incomingId)
      : categoryIndexBySlug.get(
          normalized.slug,
        );

    if (index !== undefined) {
      const existing = categories[index];
      categoryIdMap[incomingId] = String(
        existing.id,
      );

      if (
        isNewerTimestamp(
          normalized.updated_at,
          existing.updated_at,
        )
      ) {
        categories[index] = {
          ...normalized,
          id: existing.id,
          created_at:
            existing.created_at ||
            normalized.created_at,
          legacy_migration_completed_at:
            existing.legacy_migration_completed_at ||
            normalized.legacy_migration_completed_at,
          library_synced_at:
            existing.library_synced_at ||
            normalized.library_synced_at,
        };
      }

      return;
    }

    index = categories.length;
    categories.push({
      ...normalized,
      library_synced_at:
        normalized.library_synced_at ||
        nowString(),
    });
    categoryIndexById.set(incomingId, index);
    categoryIndexBySlug.set(
      normalized.slug,
      index,
    );
    categoryIdMap[incomingId] = incomingId;
  });

  const titleIndexById = new Map(
    titles.map((title, index) => [
      String(title.id),
      index,
    ]),
  );
  const titleIndexByIdentity = new Map(
    titles.map((title, index) => [
      `${title.category_id}::${title.identity_key}`,
      index,
    ]),
  );
  const normalizedChanges =
    titleChanges.map((change) => {
      const incomingCategoryId = String(
        change.category_id ||
          change.categoryId ||
          "",
      );
      const categoryId =
        categoryIdMap[incomingCategoryId] ||
        incomingCategoryId;
      return normalizeCategoryTitleInput(
        change,
        null,
        categoryId,
      );
    });

  normalizedChanges.forEach((normalized) => {
    const incomingId = String(normalized.id);
    const identity =
      `${normalized.category_id}::${normalized.identity_key}`;
    let index = titleIndexById.has(incomingId)
      ? titleIndexById.get(incomingId)
      : titleIndexByIdentity.get(identity);

    if (index !== undefined) {
      titleIdMap[incomingId] = String(
        titles[index].id,
      );
      return;
    }

    index = titles.length;
    titles.push(normalized);
    titleIndexById.set(incomingId, index);
    titleIndexByIdentity.set(identity, index);
    titleIdMap[incomingId] = incomingId;
  });

  normalizedChanges.forEach((normalized) => {
    const incomingId = String(normalized.id);
    const targetId =
      titleIdMap[incomingId] || incomingId;
    const index = titleIndexById.get(targetId);

    if (index === undefined) {
      return;
    }

    const existing = titles[index];
    const remappedPrerequisites =
      arrayFromCell(
        normalized.prerequisite_ids,
      ).map((id) =>
        titleIdMap[String(id)] || String(id),
      );
    const candidate = {
      ...normalized,
      id: existing.id,
      created_at:
        existing.created_at ||
        normalized.created_at,
      prerequisite_ids: JSON.stringify([
        ...new Set(remappedPrerequisites),
      ]),
    };

    if (
      existing === normalized ||
      isNewerTimestamp(
        candidate.updated_at,
        existing.updated_at,
      )
    ) {
      titles[index] = candidate;
    }
  });

  const deletedCategoryTimes = new Map(
    categories
      .filter((category) => category.deleted_at)
      .map((category) => [
        String(category.id),
        category.deleted_at,
      ]),
  );

  titles.forEach((title, index) => {
    const deletedAt = deletedCategoryTimes.get(
      String(title.category_id),
    );

    if (
      deletedAt &&
      (!title.deleted_at ||
        isNewerTimestamp(
          deletedAt,
          title.deleted_at,
        ))
    ) {
      titles[index] = {
        ...title,
        updated_at: deletedAt,
        deleted_at: deletedAt,
      };
    }
  });

  validateTitleRelationships(
    titles,
    categories,
  );
  writeSheetRecords(
    SHEET_NAMES.CATEGORIES,
    categories,
  );
  writeLegacyCategoryTitles(titles);

  return {
    snapshot: buildCategorizedSnapshot(),
    id_map: {
      categories: categoryIdMap,
      category_titles: titleIdMap,
    },
  };
}

function createUniqueIdFromRecords(
  records,
  prefix,
) {
  const ids = new Set(
    records.map((record) => String(record.id)),
  );

  for (
    let attempt = 0;
    attempt < 20;
    attempt += 1
  ) {
    const id =
      `${prefix}-${dateStamp()}-${randomPair()}`;

    if (!ids.has(id)) {
      return id;
    }
  }

  throw new Error(
    "Could not generate a unique ID.",
  );
}

function movieFromCategoryTitle(
  title,
  movies,
  timestamp,
) {
  return {
    id: createUniqueIdFromRecords(
      movies,
      "MOV",
    ),
    external_source: "tmdb",
    external_id: Number(title.tmdb_id),
    title: title.title,
    poster_url: tmdbPosterUrl(
      title.poster_path,
    ),
    release_date:
      title.release_date || null,
    media_type: title.media_type,
    runtime_minutes:
      title.runtime_minutes || null,
    status: "unlisted",
    rating: null,
    review: null,
    created_at: timestamp,
    updated_at: timestamp,
    base_title:
      title.base_title || title.title,
    original_title:
      title.original_title || title.title,
    season_number:
      title.season_number || null,
    season_tmdb_id:
      title.season_tmdb_id || null,
    identity_key: title.identity_key,
    backdrop_path:
      title.backdrop_path || null,
    poster_path:
      title.poster_path || null,
  };
}

function updateMovieFromCategoryTitle(
  movie,
  title,
  timestamp,
) {
  return {
    ...movie,
    external_source: "tmdb",
    external_id: Number(title.tmdb_id),
    title: title.title,
    poster_url:
      tmdbPosterUrl(title.poster_path) ||
      movie.poster_url || null,
    release_date:
      title.release_date ||
      movie.release_date || null,
    media_type: title.media_type,
    runtime_minutes:
      title.runtime_minutes ||
      movie.runtime_minutes || null,
    status: movie.status || "unlisted",
    base_title:
      title.base_title ||
      movie.base_title ||
      title.title,
    original_title:
      title.original_title ||
      movie.original_title ||
      title.title,
    season_number:
      title.season_number || null,
    season_tmdb_id:
      title.season_tmdb_id || null,
    identity_key: title.identity_key,
    backdrop_path:
      title.backdrop_path ||
      movie.backdrop_path || null,
    poster_path:
      title.poster_path ||
      movie.poster_path || null,
    updated_at: timestamp,
  };
}

function validateCategoryMovieRelationships(
  memberships,
  categories,
) {
  const activeCategoryIds = new Set(
    categories
      .filter((category) =>
        !category.deleted_at,
      )
      .map((category) =>
        String(category.id),
      ),
  );
  const activeMemberships = memberships.filter(
    (membership) => !membership.deleted_at,
  );
  const membershipByCategoryMovie = new Map(
    activeMemberships.map((membership) => [
      `${membership.category_id}::${membership.movie_id}`,
      membership,
    ]),
  );

  activeMemberships.forEach((membership) => {
    const categoryId = String(
      membership.category_id,
    );

    if (!activeCategoryIds.has(categoryId)) {
      throw new Error(
        "A category movie belongs to a missing category.",
      );
    }

    arrayFromCell(
      membership.prerequisite_movie_ids,
    ).forEach((movieId) => {
      if (
        !membershipByCategoryMovie.has(
          `${categoryId}::${movieId}`,
        )
      ) {
        throw new Error(
          "Category prerequisites must belong to the same category.",
        );
      }
    });
  });

  function visit(
    membership,
    visiting,
    visited,
  ) {
    const key =
      `${membership.category_id}::${membership.movie_id}`;

    if (visiting.has(key)) {
      throw new Error(
        "Category prerequisites contain a circular dependency.",
      );
    }

    if (visited.has(key)) {
      return;
    }

    visiting.add(key);
    arrayFromCell(
      membership.prerequisite_movie_ids,
    ).forEach((movieId) => {
      const prerequisite =
        membershipByCategoryMovie.get(
          `${membership.category_id}::${movieId}`,
        );

      if (prerequisite) {
        visit(
          prerequisite,
          visiting,
          visited,
        );
      }
    });
    visiting.delete(key);
    visited.add(key);
  }

  const visited = new Set();
  activeMemberships.forEach((membership) =>
    visit(membership, new Set(), visited),
  );
}

function mergeSyncedCategoryTitleChangesUnlocked(
  changes,
) {
  const categories = readSheet(
    SHEET_NAMES.CATEGORIES,
  );
  const movies = readSheet(
    SHEET_NAMES.MOVIES,
  );
  const memberships = readSheet(
    SHEET_NAMES.CATEGORY_MOVIES,
  );
  const syncedCategoryIds = new Set(
    categories
      .filter((category) =>
        category.library_synced_at,
      )
      .map((category) =>
        String(category.id),
      ),
  );
  const membershipIndexById = new Map(
    memberships.map((membership, index) => [
      String(membership.id),
      index,
    ]),
  );
  const membershipIndexByCategoryMovie = new Map(
    memberships.map((membership, index) => [
      `${membership.category_id}::${membership.movie_id}`,
      index,
    ]),
  );
  const movieIndexById = new Map(
    movies.map((movie, index) => [
      String(movie.id),
      index,
    ]),
  );
  const titleIdMap = {};
  const movieIdByIncomingTitleId = new Map();
  const acceptedChanges = [];

  changes.forEach((title) => {
    const categoryId = String(title.category_id);

    if (!syncedCategoryIds.has(categoryId)) {
      throw new Error(
        "The category must be migrated before writing to category_movies.",
      );
    }

    let movie = findMainMovieForCategoryTitle(
      movies,
      title,
    );
    let movieIndex;

    if (!movie) {
      if (title.movie_id) {
        throw new Error("A series item must reference an existing movie.");
      }
      movie = movieFromCategoryTitle(
        title,
        movies,
        title.updated_at || nowString(),
      );
      movieIndex = movies.length;
      movies.push(movie);
      movieIndexById.set(
        String(movie.id),
        movieIndex,
      );
    } else {
      movieIndex = movieIndexById.get(
        String(movie.id),
      );
    }

    const incomingId = String(title.id);
    const categoryMovieKey =
      `${categoryId}::${movie.id}`;
    let membershipIndex =
      membershipIndexById.has(incomingId)
        ? membershipIndexById.get(incomingId)
        : membershipIndexByCategoryMovie.get(
            categoryMovieKey,
          );
    const existingMembership =
      membershipIndex === undefined
        ? null
        : memberships[membershipIndex];
    const membershipId = existingMembership
      ? String(existingMembership.id)
      : incomingId;
    const shouldApply =
      !existingMembership ||
      isNewerTimestamp(
        title.updated_at,
        existingMembership.updated_at,
      );

    titleIdMap[incomingId] = membershipId;
    movieIdByIncomingTitleId.set(
      incomingId,
      String(movie.id),
    );

    if (!shouldApply) {
      return;
    }

    const timestamp =
      title.updated_at || nowString();
    if (!title.movie_id) {
      movies[movieIndex] = updateMovieFromCategoryTitle(movie, title, timestamp);
    }
    const membership = {
      ...(existingMembership || {}),
      id: membershipId,
      category_id: categoryId,
      movie_id: movie.id,
      is_watched: booleanFromCell(
        title.is_watched,
      ),
      sort_order: Number(title.sort_order) || 0,
      note: title.note || "",
      prerequisite_movie_ids:
        existingMembership
          ? existingMembership.prerequisite_movie_ids
          : "[]",
      legacy_category_title_id:
        existingMembership
          ? existingMembership.legacy_category_title_id
          : incomingId,
      created_at:
        existingMembership
          ? existingMembership.created_at
          : title.created_at || timestamp,
      updated_at: timestamp,
      deleted_at:
        title.deleted_at || null,
    };

    if (membershipIndex === undefined) {
      membershipIndex = memberships.length;
      memberships.push(membership);
      membershipIndexById.set(
        membershipId,
        membershipIndex,
      );
      membershipIndexByCategoryMovie.set(
        categoryMovieKey,
        membershipIndex,
      );
    } else {
      memberships[membershipIndex] = membership;
    }

    acceptedChanges.push({
      title,
      membershipId,
    });
  });

  acceptedChanges.forEach(
    ({ title, membershipId }) => {
      const membershipIndex =
        membershipIndexById.get(membershipId);
      const membership =
        memberships[membershipIndex];
      const prerequisiteMovieIds = arrayFromCell(
        title.prerequisite_ids,
      ).map((prerequisiteId) => {
        const incomingMovieId =
          movieIdByIncomingTitleId.get(
            String(prerequisiteId),
          );

        if (incomingMovieId) {
          return incomingMovieId;
        }

        const canonicalMembershipId =
          titleIdMap[String(prerequisiteId)] ||
          String(prerequisiteId);
        const prerequisiteIndex =
          membershipIndexById.get(
            canonicalMembershipId,
          );

        if (prerequisiteIndex === undefined) {
          throw new Error(
            "A category prerequisite could not be found.",
          );
        }

        return String(
          memberships[prerequisiteIndex].movie_id,
        );
      });

      memberships[membershipIndex] = {
        ...membership,
        prerequisite_movie_ids:
          JSON.stringify([
            ...new Set(prerequisiteMovieIds),
          ]),
      };
    },
  );

  const deletedCategoryTimes = new Map(
    categories
      .filter((category) => category.deleted_at)
      .map((category) => [
        String(category.id),
        category.deleted_at,
      ]),
  );

  memberships.forEach((membership, index) => {
    const deletedAt = deletedCategoryTimes.get(
      String(membership.category_id),
    );

    if (
      deletedAt &&
      (!membership.deleted_at ||
        isNewerTimestamp(
          deletedAt,
          membership.deleted_at,
        ))
    ) {
      memberships[index] = {
        ...membership,
        updated_at: deletedAt,
        deleted_at: deletedAt,
      };
    }
  });

  validateCategoryMovieRelationships(
    memberships,
    categories,
  );
  writeSheetRecords(
    SHEET_NAMES.MOVIES,
    movies,
  );
  writeSheetRecords(
    SHEET_NAMES.CATEGORY_MOVIES,
    memberships,
  );

  return titleIdMap;
}

function mergeCategorizedChangesUnlocked(payload) {
  const categoryChanges = Array.isArray(
    payload.categories,
  )
    ? payload.categories
    : [];
  const titleChanges = Array.isArray(
    payload.category_titles,
  )
    ? payload.category_titles
    : [];

  if (
    categoryChanges.length > MAX_SYNC_RECORDS ||
    titleChanges.length > MAX_SYNC_RECORDS
  ) {
    throw new Error(
      "The sync batch is too large.",
    );
  }

  const categoryResult =
    mergeLegacyCategorizedChangesUnlocked({
      categories: categoryChanges,
      category_titles: [],
    });
  const categoryIdMap =
    categoryResult.id_map.categories || {};
  const categories = readSheet(
    SHEET_NAMES.CATEGORIES,
  );
  const syncedCategoryIds = new Set(
    categories
      .filter((category) =>
        category.library_synced_at,
      )
      .map((category) =>
        String(category.id),
      ),
  );
  const normalizedChanges = titleChanges.map(
    (change) => {
      const incomingCategoryId = String(
        change.category_id ||
          change.categoryId ||
          "",
      );
      const categoryId =
        categoryIdMap[incomingCategoryId] ||
        incomingCategoryId;

      return normalizeCategoryTitleInput(
        change,
        null,
        categoryId,
      );
    },
  );
  const legacyChanges = normalizedChanges.filter(
    (title) =>
      !syncedCategoryIds.has(
        String(title.category_id),
      ),
  );
  const syncedChanges = normalizedChanges.filter(
    (title) =>
      syncedCategoryIds.has(
        String(title.category_id),
      ),
  );
  const legacyResult = legacyChanges.length
    ? mergeLegacyCategorizedChangesUnlocked({
        categories: [],
        category_titles: legacyChanges,
      })
    : { id_map: { category_titles: {} } };
  const syncedTitleIdMap =
    mergeSyncedCategoryTitleChangesUnlocked(
      syncedChanges,
    );

  return {
    snapshot: buildCategorizedSnapshot(),
    id_map: {
      categories: categoryIdMap,
      category_titles: {
        ...(legacyResult.id_map.category_titles || {}),
        ...syncedTitleIdMap,
      },
    },
  };
}

function syncCategorizedLibrary(payload) {
  ensureCategorizedSheets();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    return mergeCategorizedChangesUnlocked(
      payload || {},
    );
  } finally {
    lock.releaseLock();
  }
}

function syncCategoryLibrary(payload) {
  ensureCategorizedSheets();
  const categoryId = requiredText(
    payload && payload.category_id,
    "Category ID",
    100,
  );
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const categories = readSheet(
      SHEET_NAMES.CATEGORIES,
    );
    const categoryIndex = categories.findIndex(
      (category) =>
        String(category.id) === categoryId &&
        !category.deleted_at,
    );

    if (categoryIndex === -1) {
      throw new Error(
        "Category was not found.",
      );
    }

    if (categories[categoryIndex].library_synced_at) {
      return {
        status: "already_synced",
        migrated_count: 0,
        snapshot: buildCategorizedSnapshot(),
      };
    }

    const legacyTitles = readOptionalSheet(
      SHEET_NAMES.CATEGORY_TITLES,
    ).filter(
      (title) =>
        String(title.category_id) === categoryId &&
        !title.deleted_at,
    );
    const movies = readSheet(
      SHEET_NAMES.MOVIES,
    );
    const memberships = readSheet(
      SHEET_NAMES.CATEGORY_MOVIES,
    );
    const membershipIndexByCategoryMovie =
      new Map(
        memberships.map((membership, index) => [
          `${membership.category_id}::${membership.movie_id}`,
          index,
        ]),
      );
    const movieIdByLegacyTitleId = new Map();
    let createdMovieCount = 0;
    const timestamp = nowString();

    legacyTitles.forEach((title) => {
      let movie = findMainMovieForCategoryTitle(
        movies,
        title,
      );

      if (!movie) {
        movie = movieFromCategoryTitle(
          title,
          movies,
          timestamp,
        );
        movies.push(movie);
        createdMovieCount += 1;
      } else {
        const movieIndex = movies.findIndex(
          (record) =>
            String(record.id) ===
              String(movie.id),
        );
        const mergedMovie =
          updateMovieFromCategoryTitle(
            movie,
            title,
            timestamp,
          );
        movies[movieIndex] = {
          ...mergedMovie,
          title: movie.title || mergedMovie.title,
          base_title:
            movie.base_title ||
            mergedMovie.base_title,
          original_title:
            movie.original_title ||
            mergedMovie.original_title,
          poster_url:
            movie.poster_url ||
            mergedMovie.poster_url,
          poster_path:
            movie.poster_path ||
            mergedMovie.poster_path,
        };
        movie = movies[movieIndex];
      }

      movieIdByLegacyTitleId.set(
        String(title.id),
        String(movie.id),
      );
      const membershipKey =
        `${categoryId}::${movie.id}`;
      const existingIndex =
        membershipIndexByCategoryMovie.get(
          membershipKey,
        );
      const existing =
        existingIndex === undefined
          ? null
          : memberships[existingIndex];
      const membership = {
        ...(existing || {}),
        id: existing
          ? existing.id
          : String(title.id),
        category_id: categoryId,
        movie_id: movie.id,
        is_watched: booleanFromCell(
          title.is_watched,
        ),
        prerequisite_movie_ids: "[]",
        legacy_category_title_id: title.id,
        created_at:
          existing
            ? existing.created_at
            : title.created_at || timestamp,
        updated_at: timestamp,
        deleted_at: null,
      };

      if (existingIndex === undefined) {
        membershipIndexByCategoryMovie.set(
          membershipKey,
          memberships.length,
        );
        memberships.push(membership);
      } else {
        memberships[existingIndex] = membership;
      }
    });

    legacyTitles.forEach((title) => {
      const movieId = movieIdByLegacyTitleId.get(
        String(title.id),
      );
      const membershipIndex =
        membershipIndexByCategoryMovie.get(
          `${categoryId}::${movieId}`,
        );
      const prerequisiteMovieIds = arrayFromCell(
        title.prerequisite_ids,
      ).map((titleId) => {
        const prerequisiteMovieId =
          movieIdByLegacyTitleId.get(
            String(titleId),
          );

        if (!prerequisiteMovieId) {
          throw new Error(
            "A legacy category prerequisite could not be migrated.",
          );
        }

        return prerequisiteMovieId;
      });

      memberships[membershipIndex] = {
        ...memberships[membershipIndex],
        prerequisite_movie_ids:
          JSON.stringify([
            ...new Set(prerequisiteMovieIds),
          ]),
      };
    });

    categories[categoryIndex] = {
      ...categories[categoryIndex],
      library_synced_at: timestamp,
      updated_at: timestamp,
    };

    validateCategoryMovieRelationships(
      memberships,
      categories,
    );
    writeSheetRecords(
      SHEET_NAMES.MOVIES,
      movies,
    );
    writeSheetRecords(
      SHEET_NAMES.CATEGORY_MOVIES,
      memberships,
    );
    writeSheetRecords(
      SHEET_NAMES.CATEGORIES,
      categories,
    );

    return {
      status: "synced",
      migrated_count: legacyTitles.length,
      created_movie_count: createdMovieCount,
      reused_movie_count:
        legacyTitles.length - createdMovieCount,
      snapshot: buildCategorizedSnapshot(),
    };
  } finally {
    lock.releaseLock();
  }
}

function migrateLegacyMarvel(payload) {
  ensureCategorizedSheets();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const categories = readSheet(
      SHEET_NAMES.CATEGORIES,
    );
    const marvelIndex = categories.findIndex(
      (category) =>
        String(category.id) === "CAT-MARVEL" ||
        String(category.slug) === "marvel",
    );

    if (marvelIndex === -1) {
      throw new Error(
        "Marvel Films category was not found.",
      );
    }

    const marvel = categories[marvelIndex];

    if (marvel.legacy_migration_completed_at) {
      return {
        status: "already_completed",
        snapshot: buildCategorizedSnapshot(),
      };
    }

    const legacyTitles = Array.isArray(
      payload && payload.titles,
    )
      ? payload.titles
      : [];

    if (!legacyTitles.length) {
      throw new Error(
        "No legacy Marvel titles were found in this browser.",
      );
    }

    if (legacyTitles.length > MAX_SYNC_RECORDS) {
      throw new Error(
        "The legacy Marvel library is too large to migrate in one request.",
      );
    }

    mergeCategorizedChangesUnlocked({
      categories: [],
      category_titles: legacyTitles.map(
        (title) => ({
          ...title,
          category_id: marvel.id,
        }),
      ),
    });

    const refreshedCategories = readSheet(
      SHEET_NAMES.CATEGORIES,
    );
    const refreshedMarvelIndex =
      refreshedCategories.findIndex(
        (category) =>
          String(category.id) ===
            String(marvel.id),
      );
    const completedAt = nowString();
    refreshedCategories[refreshedMarvelIndex] = {
      ...refreshedCategories[
        refreshedMarvelIndex
      ],
      legacy_migration_completed_at:
        completedAt,
      updated_at: completedAt,
    };
    writeSheetRecords(
      SHEET_NAMES.CATEGORIES,
      refreshedCategories,
    );

    return {
      status: "migrated",
      migrated_count: legacyTitles.length,
      snapshot: buildCategorizedSnapshot(),
    };
  } finally {
    lock.releaseLock();
  }
}

function tmdbPosterUrl(path) {
  const value = String(path || "").trim();

  if (!value) {
    return null;
  }

  if (/^https:\/\//i.test(value)) {
    return value;
  }

  return `https://image.tmdb.org/t/p/w500${
    value.startsWith("/") ? value : `/${value}`
  }`;
}

function findMainMovieForCategoryTitle(
  movies,
  title,
) {
  if (title.movie_id) {
    return movies.find(
      (movie) => String(movie.id) === String(title.movie_id),
    ) || null;
  }

  const identityMatch = movies.find(
    (movie) =>
      movie.identity_key &&
      String(movie.identity_key) ===
        String(title.identity_key),
  );

  if (identityMatch) {
    return identityMatch;
  }

  if (title.season_number) {
    return null;
  }

  return (
    movies.find(
      (movie) =>
        String(movie.external_source) ===
          "tmdb" &&
        Number(movie.external_id) ===
          Number(title.tmdb_id) &&
        String(movie.media_type) ===
          String(title.media_type),
    ) || null
  );
}

function recordCategorizedViewing(payload) {
  ensureCategorizedSheets();
  const eventId = requiredText(
    payload && payload.event_id,
    "Viewing event ID",
    100,
  );
  const categoryTitleId = requiredText(
    payload && payload.category_title_id,
    "Category title ID",
    100,
  );
  const watchedAt =
    optionalDate(
      payload && payload.watched_at,
      "Watched date",
    ) || todayString();
  const watchedInTheater = booleanFromCell(
    payload && payload.watched_in_theater,
  );
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const memberships = readSheet(
      SHEET_NAMES.CATEGORY_MOVIES,
    );
    const membershipIndex =
      memberships.findIndex(
        (membership) =>
          String(membership.id) ===
            categoryTitleId &&
          !membership.deleted_at,
      );
    const existingHistory = readSheet(
      SHEET_NAMES.WATCH_HISTORY,
    ).find(
      (entry) =>
        String(entry.source_event_id) ===
        eventId,
    );

    if (existingHistory) {
      if (
        membershipIndex !== -1 &&
        !booleanFromCell(
          memberships[membershipIndex]
            .is_watched,
        )
      ) {
        memberships[membershipIndex] = {
          ...memberships[membershipIndex],
          is_watched: true,
          updated_at: nowString(),
        };
        writeSheetRecords(
          SHEET_NAMES.CATEGORY_MOVIES,
          memberships,
        );
      }

      const existingTitles = readOptionalSheet(
        SHEET_NAMES.CATEGORY_TITLES,
      );
      const existingTitleIndex =
        existingTitles.findIndex(
          (title) =>
            String(title.id) ===
            categoryTitleId,
        );

      if (
        existingTitleIndex !== -1 &&
        !booleanFromCell(
          existingTitles[
            existingTitleIndex
          ].is_watched,
        )
      ) {
        existingTitles[existingTitleIndex] = {
          ...existingTitles[
            existingTitleIndex
          ],
          is_watched: true,
          updated_at: nowString(),
        };
        writeLegacyCategoryTitles(
          existingTitles,
        );
      }

      return {
        duplicate: true,
        history_entry: existingHistory,
        snapshot: buildCategorizedSnapshot(),
      };
    }

    if (membershipIndex !== -1) {
      const timestamp = nowString();
      const membership = {
        ...memberships[membershipIndex],
        is_watched: true,
        updated_at: timestamp,
      };
      const movie = getRecordById(
        SHEET_NAMES.MOVIES,
        membership.movie_id,
      );

      if (!movie) {
        throw new Error(
          "The category movie could not be found.",
        );
      }

      const updatedMovie = {
        ...movie,
        status: "watched",
        updated_at: timestamp,
      };
      const historyEntry = {
        id: createUniqueId(
          SHEET_NAMES.WATCH_HISTORY,
          "HIS",
        ),
        movie_id: movie.id,
        watched_at: watchedAt,
        watched_in_theater: watchedInTheater,
        created_at: timestamp,
        source_event_id: eventId,
        category_title_id: membership.id,
      };

      memberships[membershipIndex] = membership;
      writeSheetRecords(
        SHEET_NAMES.CATEGORY_MOVIES,
        memberships,
      );
      updateRecord(
        SHEET_NAMES.MOVIES,
        movie.id,
        updatedMovie,
      );
      appendRecord(
        SHEET_NAMES.WATCH_HISTORY,
        historyEntry,
      );

      const snapshot = buildCategorizedSnapshot();

      return {
        duplicate: false,
        category_title:
          snapshot.category_titles.find(
            (title) =>
              String(title.id) ===
                categoryTitleId,
          ) || null,
        movie: updatedMovie,
        history_entry: historyEntry,
        snapshot,
      };
    }

    const titles = readOptionalSheet(
      SHEET_NAMES.CATEGORY_TITLES,
    );
    const titleIndex = titles.findIndex(
      (title) =>
        String(title.id) ===
        categoryTitleId,
    );

    if (
      titleIndex === -1 ||
      titles[titleIndex].deleted_at
    ) {
      throw new Error(
        "Category title was not found.",
      );
    }

    const timestamp = nowString();
    titles[titleIndex] = {
      ...titles[titleIndex],
      is_watched: true,
      updated_at: timestamp,
    };
    const categoryTitle = titles[titleIndex];
    const movies = readSheet(
      SHEET_NAMES.MOVIES,
    );
    let movie = findMainMovieForCategoryTitle(
      movies,
      categoryTitle,
    );

    if (!movie) {
      movie = {
        id: createUniqueId(
          SHEET_NAMES.MOVIES,
          "MOV",
        ),
        external_source: "tmdb",
        external_id: Number(
          categoryTitle.tmdb_id,
        ),
        title: categoryTitle.title,
        poster_url: tmdbPosterUrl(
          categoryTitle.poster_path,
        ),
        release_date:
          categoryTitle.release_date || null,
        media_type:
          categoryTitle.media_type,
        runtime_minutes:
          categoryTitle.runtime_minutes || null,
        status: "watched",
        rating: null,
        review: null,
        created_at: timestamp,
        updated_at: timestamp,
        base_title:
          categoryTitle.base_title ||
          categoryTitle.title,
        original_title:
          categoryTitle.original_title ||
          categoryTitle.title,
        season_number:
          categoryTitle.season_number || null,
        season_tmdb_id:
          categoryTitle.season_tmdb_id || null,
        identity_key:
          categoryTitle.identity_key,
        backdrop_path:
          categoryTitle.backdrop_path || null,
        poster_path:
          categoryTitle.poster_path || null,
      };
      appendRecord(
        SHEET_NAMES.MOVIES,
        movie,
      );
    } else {
      movie = {
        ...movie,
        status: "watched",
        poster_url:
          movie.poster_url ||
          tmdbPosterUrl(
            categoryTitle.poster_path,
          ),
        runtime_minutes:
          movie.runtime_minutes ||
          categoryTitle.runtime_minutes ||
          null,
        base_title:
          movie.base_title ||
          categoryTitle.base_title ||
          categoryTitle.title,
        original_title:
          movie.original_title ||
          categoryTitle.original_title ||
          categoryTitle.title,
        season_number:
          movie.season_number ||
          categoryTitle.season_number ||
          null,
        season_tmdb_id:
          movie.season_tmdb_id ||
          categoryTitle.season_tmdb_id ||
          null,
        identity_key:
          movie.identity_key ||
          categoryTitle.identity_key,
        backdrop_path:
          movie.backdrop_path ||
          categoryTitle.backdrop_path ||
          null,
        updated_at: timestamp,
      };
      updateRecord(
        SHEET_NAMES.MOVIES,
        movie.id,
        movie,
      );
    }

    const historyEntry = {
      id: createUniqueId(
        SHEET_NAMES.WATCH_HISTORY,
        "HIS",
      ),
      movie_id: movie.id,
      watched_at: watchedAt,
      watched_in_theater: watchedInTheater,
      created_at: timestamp,
      source_event_id: eventId,
      category_title_id: categoryTitle.id,
    };
    appendRecord(
      SHEET_NAMES.WATCH_HISTORY,
      historyEntry,
    );
    writeLegacyCategoryTitles(titles);

    return {
      duplicate: false,
      category_title:
        categoryTitleForClient(
          categoryTitle,
        ),
      movie,
      history_entry: historyEntry,
      snapshot: buildCategorizedSnapshot(),
    };
  } finally {
    lock.releaseLock();
  }
}

function getCategorizedData() {
  const cached = readCachedData(
    READ_CACHE_KEYS.CATEGORIZED,
  );

  if (cached) {
    return cached;
  }

  ensureCategorizedSheets();

  const data = buildCategorizedSnapshot();

  cacheReadData(
    READ_CACHE_KEYS.CATEGORIZED,
    data,
  );

  return data;
}

function getAllData() {
  const cached = readCachedData(
    READ_CACHE_KEYS.ALL,
  );

  if (cached) {
    return cached;
  }

  ensureMemorySheet();
  const categorized = getCategorizedData();

  const data = {
    movies: readSheet(
      SHEET_NAMES.MOVIES,
    ),
    watch_history: readSheet(
      SHEET_NAMES.WATCH_HISTORY,
    ),
    movie_memories: readSheet(
      SHEET_NAMES.MOVIE_MEMORIES,
    ),
    categories: categorized.categories,
    category_titles:
      categorized.category_titles,
    category_movies: readSheet(
      SHEET_NAMES.CATEGORY_MOVIES,
    ),
    category_sync: categorized.category_sync,
  };

  cacheReadData(
    READ_CACHE_KEYS.ALL,
    data,
  );

  return data;
}

function findCanonicalMovie(
  movies,
  normalizedMovie,
) {
  if (normalizedMovie.identity_key) {
    const identityMatch = movies.find(
      (movie) =>
        String(movie.identity_key || "") ===
          String(normalizedMovie.identity_key),
    );

    if (identityMatch) {
      return identityMatch;
    }
  }

  if (normalizedMovie.external_source !== "tmdb") {
    return null;
  }

  return (
    movies.find(
      (movie) =>
        String(movie.external_source) === "tmdb" &&
        Number(movie.external_id) === Number(normalizedMovie.external_id) &&
        String(movie.media_type) === String(normalizedMovie.media_type) &&
        Number(movie.season_number || 0) === Number(normalizedMovie.season_number || 0),
    ) || null
  );
}

function upsertMovieInRecords(
  movies,
  normalizedMovie,
  timestamp,
) {
  const existing = findCanonicalMovie(
    movies,
    normalizedMovie,
  );

  if (!existing) {
    const movie = {
      id: createUniqueIdFromRecords(
        movies,
        "MOV",
      ),
      ...normalizedMovie,
      created_at: timestamp,
      updated_at: timestamp,
    };
    movies.push(movie);
    return { movie, created: true };
  }

  // Adding an existing title must never overwrite its review, rating, or metadata.
  return { movie: existing, created: false };
}

function createMovie(payload) {
  const input = payload.movie || {};
  const normalizedMovie =
    normalizeMovieInput(input);

  if (normalizedMovie.status === "watched") {
    throw new Error("Use Log a Viewing to record a watched title.");
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {

    const createdAt = nowString();
    const movies = readSheet(
      SHEET_NAMES.MOVIES,
    );
    if (!findCanonicalMovie(movies, normalizedMovie) && !payload.allow_same_title) {
      const name = normalizedMovie.title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
      const sameTitle = movies.some((movie) =>
        String(movie.title || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() === name,
      );
      if (sameTitle) {
        throw new Error("This title already exists. Review the existing movie before creating another record.");
      }
    }
    const upserted = upsertMovieInRecords(movies, normalizedMovie, createdAt);
    if (upserted.created) {
      writeSheetRecords(SHEET_NAMES.MOVIES, movies);
    }

    return {
      movie: upserted.movie,
      history_entry: null,
      created: upserted.created,
    };
  } finally {
    lock.releaseLock();
  }
}

function createMovies(payload) {
  const items = Array.isArray(
    payload && payload.items,
  )
    ? payload.items
    : [];

  if (!items.length) {
    throw new Error(
      "Add at least one movie to the batch.",
    );
  }

  if (items.length > 100) {
    throw new Error(
      "A movie batch cannot exceed 100 titles.",
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const movies = readSheet(
      SHEET_NAMES.MOVIES,
    );
    const history = readSheet(
      SHEET_NAMES.WATCH_HISTORY,
    );
    const created = [];

    items.forEach((item) => {
      const normalizedMovie = normalizeMovieInput(
        item.movie || {},
      );
      const timestamp = nowString();
      const upserted = upsertMovieInRecords(
        movies,
        normalizedMovie,
        timestamp,
      );
      const movie = upserted.movie;
      const movieIndex = movies.findIndex((record) => String(record.id) === String(movie.id));
      movies[movieIndex] = { ...movie, status: "watched", updated_at: timestamp };
      let historyEntry = null;

      if (normalizedMovie.status === "watched") {
        const viewing = normalizeViewingInput({
          ...(item.viewing || {}),
          movie_id: movie.id,
        });
        historyEntry = {
          id: createUniqueIdFromRecords(
            history,
            "HIS",
          ),
          ...viewing,
          created_at: timestamp,
        };
        history.push(historyEntry);
      }

      created.push({
        movie: movies[movieIndex],
        history_entry: historyEntry,
        created: upserted.created,
      });
    });

    writeSheetRecords(
      SHEET_NAMES.MOVIES,
      movies,
    );
    writeSheetRecords(
      SHEET_NAMES.WATCH_HISTORY,
      history,
    );

    return {
      count: created.length,
      items: created,
    };
  } finally {
    lock.releaseLock();
  }
}

function updateMovie(payload) {
  const movieId = requiredText(
    payload.id,
    "Movie ID",
    50,
  );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const existingMovie = getRecordById(
      SHEET_NAMES.MOVIES,
      movieId,
    );

    if (!existingMovie) {
      throw new Error(
        "Movie was not found.",
      );
    }

    const normalizedMovie =
      normalizeMovieInput({
        ...existingMovie,
        ...payload,
      });

    const updatedMovie = {
      ...existingMovie,
      ...normalizedMovie,
      id: existingMovie.id,
      created_at:
        existingMovie.created_at ||
        nowString(),
      updated_at: nowString(),
    };

    updateRecord(
      SHEET_NAMES.MOVIES,
      movieId,
      updatedMovie,
    );

    return {
      movie: updatedMovie,
    };
  } finally {
    lock.releaseLock();
  }
}

function logViewing(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const movies = readSheet(SHEET_NAMES.MOVIES);
    const timestamp = nowString();
    const movieId = payload.movie_id ? String(payload.movie_id) : null;
    let movie = movieId
      ? movies.find((record) => String(record.id) === movieId)
      : null;
    let created = false;

    if (movieId && !movie) {
      throw new Error("The selected movie was not found. Refresh and choose it again.");
    }

    if (!movie) {
      const normalized = normalizeMovieInput({
        ...(payload.movie || {}),
        status: "watched",
        rating: null,
        review: null,
      });
      if (normalized.external_source !== "tmdb") {
        throw new Error("Add manual titles to your library before logging a viewing.");
      }
      const matches = movies.filter((record) =>
        String(record.external_source) === "tmdb" &&
        Number(record.external_id) === Number(normalized.external_id) &&
        String(record.media_type) === String(normalized.media_type) &&
        Number(record.season_number || 0) === Number(normalized.season_number || 0),
      );
      if (matches.length > 1) {
        throw new Error("Multiple records exist for this title. Select one from your library before saving.");
      }
      movie = matches[0] || null;
      if (!movie) {
        const name = normalized.title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
        const sameTitle = movies.some((record) =>
          String(record.title || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() === name,
        );
        if (sameTitle && !payload.allow_same_title) {
          throw new Error("A movie with this title already exists. Review it before creating a new record.");
        }
        movie = {
          id: createUniqueIdFromRecords(movies, "MOV"),
          ...normalized,
          created_at: timestamp,
          updated_at: timestamp,
        };
        movies.push(movie);
        created = true;
      }
    }

    const viewing = normalizeViewingInput({
      ...(payload.viewing || {}),
      movie_id: movie.id,
    });
    const updatedMovie = {
      ...movie,
      status: "watched",
      updated_at: timestamp,
    };
    const index = movies.findIndex((record) => String(record.id) === String(movie.id));
    movies[index] = updatedMovie;
    const historyEntry = {
      id: createUniqueId(SHEET_NAMES.WATCH_HISTORY, "HIS"),
      ...viewing,
      created_at: timestamp,
    };

    writeSheetRecords(SHEET_NAMES.MOVIES, movies);
    appendRecord(SHEET_NAMES.WATCH_HISTORY, historyEntry);
    return { movie: updatedMovie, history_entry: historyEntry, created };
  } finally {
    lock.releaseLock();
  }
}

function addViewing(payload) {
  const movieId = requiredText(
    payload.movie_id,
    "Movie ID",
    50,
  );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const movie = getRecordById(
      SHEET_NAMES.MOVIES,
      movieId,
    );

    if (!movie) {
      throw new Error(
        "Movie was not found.",
      );
    }

    const viewing =
      normalizeViewingInput(payload);

    const historyEntry = {
      id: createUniqueId(
        SHEET_NAMES.WATCH_HISTORY,
        "HIS",
      ),
      ...viewing,
      created_at: nowString(),
    };

    const updatedMovie = {
      ...movie,
      status: "watched",
      updated_at: nowString(),
    };

    appendRecord(
      SHEET_NAMES.WATCH_HISTORY,
      historyEntry,
    );

    updateRecord(
      SHEET_NAMES.MOVIES,
      movieId,
      updatedMovie,
    );

    return {
      movie: updatedMovie,
      history_entry: historyEntry,
    };
  } finally {
    lock.releaseLock();
  }
}

function createMemory(payload) {
  ensureMemorySheet();

  const input = payload.memory || payload || {};
  const normalizedMemory =
    normalizeMemoryInput(input);

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const movie = getRecordById(
      SHEET_NAMES.MOVIES,
      normalizedMemory.movie_id,
    );

    if (!movie) {
      throw new Error(
        "Movie was not found.",
      );
    }

    const duplicateAsset = readSheet(
      SHEET_NAMES.MOVIE_MEMORIES,
    ).find(
      (memory) =>
        String(memory.public_id) ===
        String(
          normalizedMemory.public_id,
        ),
    );

    if (duplicateAsset) {
      throw new Error(
        "This memory image has already been saved.",
      );
    }

    const createdAt = nowString();
    const memory = {
      id: createUniqueId(
        SHEET_NAMES.MOVIE_MEMORIES,
        "MEM",
      ),
      ...normalizedMemory,
      created_at: createdAt,
      updated_at: createdAt,
    };

    appendRecord(
      SHEET_NAMES.MOVIE_MEMORIES,
      memory,
    );

    return { memory };
  } finally {
    lock.releaseLock();
  }
}

function updateMemory(payload) {
  ensureMemorySheet();

  const memoryId = requiredText(
    payload.id,
    "Memory ID",
    50,
  );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const existingMemory = getRecordById(
      SHEET_NAMES.MOVIE_MEMORIES,
      memoryId,
    );

    if (!existingMemory) {
      throw new Error(
        "Memory was not found.",
      );
    }

    const memoryType = String(
      payload.memory_type ||
      existingMemory.memory_type ||
      "photo",
    );

    if (
      !ALLOWED_MEMORY_TYPES.includes(
        memoryType,
      )
    ) {
      throw new Error(
        "Invalid memory type.",
      );
    }

    const updatedMemory = {
      ...existingMemory,
      caption: optionalText(
        payload.caption,
        "Caption",
        1000,
      ),
      memory_type: memoryType,
      memory_date: optionalDate(
        payload.memory_date,
        "Memory date",
      ),
      sort_order:
        optionalNumber(
          payload.sort_order,
          "Sort order",
          { min: 0, max: 100000 },
        ) || 0,
      updated_at: nowString(),
    };

    updateRecord(
      SHEET_NAMES.MOVIE_MEMORIES,
      memoryId,
      updatedMemory,
    );

    return { memory: updatedMemory };
  } finally {
    lock.releaseLock();
  }
}

function deleteMemory(payload) {
  ensureMemorySheet();

  const memoryId = requiredText(
    payload.id,
    "Memory ID",
    50,
  );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getSheet(
      SHEET_NAMES.MOVIE_MEMORIES,
    );

    const rowNumber = findRowNumberById(
      sheet,
      memoryId,
    );

    if (!rowNumber) {
      throw new Error(
        "Memory was not found.",
      );
    }

    const memory = getRecordById(
      SHEET_NAMES.MOVIE_MEMORIES,
      memoryId,
    );

    sheet.deleteRow(rowNumber);

    return { memory };
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data),
    )
    .setMimeType(
      ContentService.MimeType.JSON,
    );
}

function getApiSecret() {
  return PropertiesService
    .getScriptProperties()
    .getProperty("API_SECRET");
}

function isGetAuthorized(e) {
  const receivedSecret =
    e && e.parameter
      ? e.parameter.secret
      : "";

  const expectedSecret = getApiSecret();

  return (
    Boolean(expectedSecret) &&
    receivedSecret === expectedSecret
  );
}

function isPostAuthorized(body) {
  const expectedSecret = getApiSecret();

  return (
    Boolean(expectedSecret) &&
    body.secret === expectedSecret
  );
}

function doGet(e) {
  if (!isGetAuthorized(e)) {
    return createJsonResponse({
      success: false,
      message: "Unauthorized",
    });
  }

  try {
    const scope =
      e && e.parameter
        ? String(e.parameter.scope || "")
        : "";

    return createJsonResponse({
      success: true,
      data:
        scope === "categorized"
          ? getCategorizedData()
          : getAllData(),
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      message: error.message,
    });
  }
}

function doPost(e) {
  try {
    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {
      throw new Error(
        "Request body is missing.",
      );
    }

    const body = JSON.parse(
      e.postData.contents,
    );

    if (!isPostAuthorized(body)) {
      return createJsonResponse({
        success: false,
        message: "Unauthorized",
      });
    }

    let data;

    switch (body.action) {
      case "createMovie":
        data = createMovie(
          body.data || {},
        );
        break;

      case "createMovies":
        data = createMovies(
          body.data || {},
        );
        break;

      case "updateMovie":
        data = updateMovie(
          body.data || {},
        );
        break;

      case "logViewing":
        data = logViewing(body.data || {});
        break;

      case "addViewing":
        data = addViewing(
          body.data || {},
        );
        break;

      case "createMemory":
        data = createMemory(
          body.data || {},
        );
        break;

      case "updateMemory":
        data = updateMemory(
          body.data || {},
        );
        break;

      case "deleteMemory":
        data = deleteMemory(
          body.data || {},
        );
        break;

      case "syncCategorizedLibrary":
        data = syncCategorizedLibrary(
          body.data || {},
        );
        break;

      case "syncCategoryLibrary":
        data = syncCategoryLibrary(
          body.data || {},
        );
        break;

      case "migrateLegacyMarvel":
        data = migrateLegacyMarvel(
          body.data || {},
        );
        break;

      case "recordCategorizedViewing":
        data = recordCategorizedViewing(
          body.data || {},
        );
        break;

      default:
        throw new Error(
          "Unknown API action.",
        );
    }

    invalidateReadDataCache();

    return createJsonResponse({
      success: true,
      data,
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      message: error.message,
    });
  }
}

function testConnection() {
  console.log(
    getSpreadsheet().getName(),
  );
}

function testReadData() {
  console.log(
    JSON.stringify(
      getAllData(),
      null,
      2,
    ),
  );
}
function setupMovieMemoriesSheet() {
  ensureMemorySheet();
  console.log("movie_memories sheet is ready.");
}

function setupCategorizedSheets() {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(
      "CATEGORIZED_SCHEMA_VERSION",
    );
  ensureCategorizedSheets();
  console.log(
    "Seenetrica categorized sheets are ready.",
  );
}
