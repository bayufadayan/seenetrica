import { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_MEDIA_TYPES,
  MAX_MEMORY_BYTES,
  MAX_MEMORY_FILES,
  VIDEO_TYPES,
} from "../../utils/constants";

function id() {
  return (
    window.crypto?.randomUUID?.() ||
    `memory-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}
function typeFor(file) {
  const name = file.name.toLowerCase();
  if (VIDEO_TYPES.has(file.type)) return "other";
  if (/ticket|tiket|receipt|struk/.test(name)) return "ticket";
  if (/poster/.test(name)) return "poster";
  if (/screenshot|screen.?shot|capture/.test(name)) return "screenshot";
  return "photo";
}

export function useMemoryDrafts(maxFiles = MAX_MEMORY_FILES) {
  const [drafts, setDrafts] = useState([]);
  const urls = useRef(new Set());
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const available = Math.max(0, maxFiles - drafts.length);
    const errors = [];
    const next = [];
    files.slice(0, available).forEach((file) => {
      if (!ACCEPTED_MEDIA_TYPES.has(file.type)) {
        errors.push(
          `${file.name}: use JPEG, PNG, WebP, MP4, WebM, MOV, or M4V.`,
        );
        return;
      }
      if (file.size > MAX_MEMORY_BYTES) {
        errors.push(`${file.name}: larger than 15 MB.`);
        return;
      }
      const preview_url = URL.createObjectURL(file);
      urls.current.add(preview_url);
      next.push({
        client_id: id(),
        file,
        preview_url,
        caption: "",
        memory_type: typeFor(file),
        memory_date: "",
        status: "idle",
        status_message: VIDEO_TYPES.has(file.type)
          ? "Video ready"
          : "Photo ready",
      });
    });
    if (files.length > available)
      errors.push(`Only ${maxFiles} memories can be prepared at once.`);
    setDrafts((items) => [...items, ...next]);
    return errors;
  }
  function update(clientId, values) {
    setDrafts((items) =>
      items.map((item) =>
        item.client_id === clientId ? { ...item, ...values } : item,
      ),
    );
  }
  function remove(clientId) {
    setDrafts((items) =>
      items.filter((item) => {
        if (item.client_id !== clientId) return true;
        URL.revokeObjectURL(item.preview_url);
        urls.current.delete(item.preview_url);
        return false;
      }),
    );
  }
  function clear() {
    setDrafts((items) => {
      items.forEach((item) => {
        URL.revokeObjectURL(item.preview_url);
        urls.current.delete(item.preview_url);
      });
      return [];
    });
  }
  return { drafts, setDrafts, addFiles, update, remove, clear, maxFiles };
}
