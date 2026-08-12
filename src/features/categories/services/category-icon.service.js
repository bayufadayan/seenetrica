import { archiveService } from "../../../services/archive.service";

export const CATEGORY_ICON_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const CATEGORY_ICON_SIZE = 96;

export function validateCategoryIcon(file) {
  if (!file) throw new Error("Choose a category icon.");
  if (!CATEGORY_ICON_TYPES.has(file.type)) {
    throw new Error("Category icons must be JPG, PNG, or WebP.");
  }
  return file;
}

export function centerSquareCrop(width, height) {
  const size = Math.min(Number(width), Number(height));
  if (!(size > 0)) throw new Error("The category icon has invalid dimensions.");
  return { x: (Number(width) - size) / 2, y: (Number(height) - size) / 2, size };
}

export async function compressCategoryIcon(file, quality = 0.84) {
  validateCategoryIcon(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The category icon could not be read."));
      element.src = objectUrl;
    });
    const crop = centerSquareCrop(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = CATEGORY_ICON_SIZE;
    canvas.height = CATEGORY_ICON_SIZE;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("This browser cannot compress the category icon.");
    context.clearRect(0, 0, CATEGORY_ICON_SIZE, CATEGORY_ICON_SIZE);
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      CATEGORY_ICON_SIZE,
      CATEGORY_ICON_SIZE,
    );
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) throw new Error("The category icon could not be compressed to WebP.");
    return new File([blob], "category-icon.webp", { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadCategoryIcon(file, slug, pin) {
  const compressed = await compressCategoryIcon(file);
  const signature = await archiveService.writeAction(
    "prepareCategoryIconUpload",
    { slug },
    pin,
  );
  const form = new FormData();
  form.append("file", compressed);
  form.append("api_key", signature.api_key);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("public_id", signature.public_id);
  if (signature.overwrite !== undefined) form.append("overwrite", String(signature.overwrite));
  const response = await fetch(signature.upload_url, { method: "POST", body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message || "Cloudinary could not upload the category icon.");
  }
  return { iconUrl: result.secure_url, iconPublicId: result.public_id };
}

export async function cleanupCategoryIcon(publicId, pin) {
  if (!publicId) return;
  await archiveService.writeAction("deleteCategoryIcon", { public_id: publicId }, pin);
}
