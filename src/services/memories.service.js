import { authenticatedPost } from "./http";
import { archiveService } from "./archive.service";
import { IMAGE_TYPES, VIDEO_TYPES } from "../utils/constants";

const MAX_LONG_EDGE = 3200;

export function mediaResourceType(value) {
  const type =
    typeof value === "string"
      ? value
      : String(value?.type || value?.image_url || "");
  return VIDEO_TYPES.has(type) || /\/video\/upload\//i.test(type)
    ? "video"
    : "image";
}

export function isVideoMemory(value) {
  return mediaResourceType(value) === "video";
}

export function googleDriveFile(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    ![
      "drive.google.com",
      "drive.usercontent.google.com",
      "lh3.googleusercontent.com",
    ].includes(hostname)
  )
    return null;
  const id =
    url.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]+)/i)?.[1] ||
    url.searchParams.get("id") ||
    "";
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return null;
  return { id, resourceKey: url.searchParams.get("resourcekey") || "" };
}

export function isGoogleDriveUrl(value) {
  try {
    return ["drive.google.com", "drive.usercontent.google.com"].includes(
      new URL(String(value).trim()).hostname
        .toLowerCase()
        .replace(/^www\./, ""),
    );
  } catch {
    return false;
  }
}

export function googleDriveImageUrl(value, options = {}) {
  const source = String(value || "").trim();
  const file = googleDriveFile(source);
  if (!file) return source;
  const width = Math.min(
    4096,
    Math.max(32, Math.round(Number(options.width) || MAX_LONG_EDGE)),
  );
  const direct = new URL(
    `https://lh3.googleusercontent.com/d/${encodeURIComponent(file.id)}=w${width}`,
  );
  if (file.resourceKey)
    direct.searchParams.set("resourcekey", file.resourceKey);
  return direct.toString();
}

export function cloudinaryImageUrl(url, options = {}) {
  const source = googleDriveImageUrl(url, {
    width: options.width || MAX_LONG_EDGE,
  });
  const marker = "/image/upload/";
  if (!source.includes(marker)) return source;
  const transforms = ["f_auto", options.quality || "q_auto:good"];
  if (options.width) transforms.push(`w_${Math.round(options.width)}`);
  if (options.height) transforms.push(`h_${Math.round(options.height)}`);
  transforms.push(options.crop ? `c_${options.crop}` : "c_limit");
  if (options.gravity) transforms.push(`g_${options.gravity}`);
  return source.replace(marker, `${marker}${transforms.join(",")}/`);
}

export function cloudinaryVideoPosterUrl(url, options = {}) {
  const source = String(url || "");
  const marker = "/video/upload/";
  if (!source.includes(marker)) return "";
  const transforms = ["so_0", "f_jpg", options.quality || "q_auto:good"];
  if (options.width) transforms.push(`w_${Math.round(options.width)}`);
  if (options.height) transforms.push(`h_${Math.round(options.height)}`);
  transforms.push(options.crop ? `c_${options.crop}` : "c_limit");
  if (options.gravity) transforms.push(`g_${options.gravity}`);
  const [path, query = ""] = source
    .replace(marker, `${marker}${transforms.join(",")}/`)
    .split("?");
  const poster = path.replace(/\.[^/.]+$/, ".jpg");
  return query ? `${poster}?${query}` : poster;
}

async function loadImage(file) {
  if (window.createImageBitmap) {
    const bitmap = await window.createImageBitmap(file).catch(() => null);
    if (bitmap)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () =>
      reject(new Error("The selected image could not be opened."));
    image.src = url;
  }).catch((error) => {
    URL.revokeObjectURL(url);
    throw error;
  });
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(url),
  };
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The browser could not prepare this image.")),
      type,
      quality,
    ),
  );
}

async function prepareImage(file) {
  const loaded = await loadImage(file);
  try {
    const scale = Math.min(
      1,
      MAX_LONG_EDGE / Math.max(loaded.width, loaded.height),
    );
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context)
      throw new Error("Image processing is not available in this browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(loaded.source, 0, 0, width, height);
    let blob;
    let extension;
    try {
      blob = await canvasBlob(canvas, "image/webp", 0.9);
      extension = "webp";
    } catch {
      blob = await canvasBlob(canvas, "image/jpeg", 0.92);
      extension = "jpg";
    }
    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "") || "memory"}.${extension}`,
      { type: blob.type, lastModified: Date.now() },
    );
  } finally {
    loaded.dispose();
  }
}

export const memoriesService = {
  prepareUpload(movieId, resourceType, pin) {
    return authenticatedPost(
      "/api/memories/sign-upload",
      { movie_id: movieId, resource_type: resourceType },
      pin,
    );
  },
  cleanupUpload(publicId, resourceType, pin) {
    return authenticatedPost(
      "/api/memories/cleanup",
      { public_id: publicId, resource_type: resourceType },
      pin,
    );
  },
  deleteMemory(memoryId, pin) {
    return authenticatedPost(
      "/api/memories/delete",
      { memory_id: memoryId },
      pin,
    );
  },
  async uploadDraft(draft, movieId, pin, sortOrder = 0) {
    const resourceType = mediaResourceType(draft.file);
    const file = IMAGE_TYPES.has(draft.file.type)
      ? await prepareImage(draft.file)
      : draft.file;
    const signature = await this.prepareUpload(movieId, resourceType, pin);
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signature.api_key);
    form.append("timestamp", String(signature.timestamp));
    form.append("signature", signature.signature);
    form.append("public_id", signature.public_id);
    form.append("overwrite", signature.overwrite);
    const response = await fetch(signature.upload_url, {
      method: "POST",
      body: form,
    });
    const upload = await response.json().catch(() => ({}));
    if (!response.ok || !upload.secure_url || !upload.public_id)
      throw new Error(
        upload.error?.message || "Cloudinary could not upload the media.",
      );
    try {
      const saved = await archiveService.writeAction(
        "createMemory",
        {
          memory: {
            movie_id: movieId,
            public_id: upload.public_id,
            image_url: upload.secure_url,
            caption: draft.caption || null,
            memory_type: draft.memory_type || "photo",
            memory_date: draft.memory_date || null,
            width: upload.width || null,
            height: upload.height || null,
            bytes: upload.bytes || file.size,
            sort_order: sortOrder,
          },
        },
        pin,
      );
      return saved.memory;
    } catch (error) {
      await this.cleanupUpload(upload.public_id, resourceType, pin).catch(
        (cleanupError) =>
          console.error(
            "Could not clean up an unlinked Cloudinary asset:",
            cleanupError,
          ),
      );
      throw error;
    }
  },
};
