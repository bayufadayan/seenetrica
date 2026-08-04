import { Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { archiveService } from "../../services/archive.service";
import {
  cloudinaryImageUrl,
  isVideoMemory,
  memoriesService,
} from "../../services/memories.service";
import { MEMORY_TYPES } from "../../utils/constants";
import { formatBytes, formatDate } from "../../utils/formatters";
import { useToast } from "../../context/ToastContext";
import { useBodyLock } from "../../hooks/useBodyLock";

export function MemoryViewerModal({ memory, movieTitle, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: memory.memory_type || "photo",
    date: memory.memory_date || "",
    caption: memory.caption || "",
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useBodyLock(true, "is-memory-modal-open");
  const video = isVideoMemory(memory);
  const caption = memory.caption || `A memory from ${movieTitle}`;
  async function save(event) {
    event.preventDefault();
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    setBusy(true);
    try {
      await archiveService.writeAction(
        "updateMemory",
        {
          id: memory.id,
          caption: form.caption.trim() || null,
          memory_type: form.type,
          memory_date: form.date || null,
          sort_order: memory.sort_order || 0,
        },
        pin,
      );
      await onSaved();
      toast("Memory details updated.");
      onClose();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !window.confirm(
        "Delete this memory from Seenetrica? This cannot be undone.",
      )
    )
      return;
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    setBusy(true);
    try {
      await memoriesService.deleteMemory(memory.id, pin);
      await onSaved();
      toast("Memory deleted.");
      onClose();
    } catch (error) {
      toast(error.message, "error");
      setBusy(false);
    }
  }
  return (
    <div
      className="memory-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-lightbox-title"
    >
      <button
        className="memory-lightbox-backdrop"
        type="button"
        aria-label="Close memory viewer"
        disabled={busy}
        onClick={onClose}
      />
      <div className="memory-lightbox-dialog">
        <div className="memory-lightbox-media">
          {video ? (
            <video
              src={memory.image_url}
              aria-label={caption}
              controls
              autoPlay
              playsInline
            />
          ) : (
            <img
              src={cloudinaryImageUrl(memory.image_url, {
                width: 2560,
                quality: "q_auto:best",
              })}
              alt={caption}
            />
          )}
        </div>
        <div className="memory-lightbox-panel">
          <div className="memory-lightbox-header">
            <div className="memory-lightbox-copy">
              <h2 id="memory-lightbox-title">{caption}</h2>
              <p>
                {[
                  video ? "video" : memory.memory_type || "photo",
                  formatDate(memory.memory_date, { fallback: "date not set" }),
                  memory.width && memory.height
                    ? `${memory.width} × ${memory.height}`
                    : null,
                  memory.bytes ? formatBytes(memory.bytes) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              className="icon-button light-icon-button"
              type="button"
              aria-label="Close"
              disabled={busy}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <form className="memory-lightbox-form" onSubmit={save}>
            <label className="form-field">
              <span>Type</span>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((v) => ({ ...v, type: e.target.value }))
                }
              >
                {MEMORY_TYPES.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((v) => ({ ...v, date: e.target.value }))
                }
              />
            </label>
            <label className="form-field is-full">
              <span>Caption</span>
              <textarea
                maxLength="1000"
                value={form.caption}
                onChange={(e) =>
                  setForm((v) => ({ ...v, caption: e.target.value }))
                }
              />
            </label>
            <div className="memory-lightbox-actions is-full">
              <button className="primary-button" type="submit" disabled={busy}>
                <Save aria-hidden="true" />
                Save changes
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={busy}
                onClick={remove}
              >
                <Trash2 aria-hidden="true" />
                Delete memory
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
