const FILMS_SUFFIX = /(?:^|\s+)(?:films?\s*)+$/i;

export function normalizeCategoryName(value) {
  return String(value || "").trim().replace(FILMS_SUFFIX, "").trim();
}

export function categoryDisplayName(value) {
  const name = normalizeCategoryName(value);
  return name ? `${name} Films` : "Films";
}

export function createCategorySlug(value) {
  return normalizeCategoryName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryIdentityKey(categoryId, identityKey) {
  return `${categoryId}::${identityKey}`;
}
