import { categoryDisplayName } from "./category.util";

export function categoryMenuItems(categories) {
  return categories.map((category) => ({
    id: category.id,
    label: categoryDisplayName(category.name),
    path: `/categories/${encodeURIComponent(category.slug)}`,
  }));
}

export function shouldCloseCategoryMenu(root, target) {
  return !root?.contains(target);
}

export function closeCategoryMenuWithEscape(event, close, trigger) {
  if (event.key !== "Escape") return false;
  close();
  trigger?.focus?.();
  return true;
}
