import { Images, Link as LinkIcon, Upload, UploadCloud, X } from "lucide-react";
import { useState } from "react";
import { MemoryDraftList } from "./MemoryDraftList";
import { useMemoryDrafts } from "./useMemoryDrafts";
import { archiveService } from "../../services/archive.service";
import {
  googleDriveFile,
  googleDriveImageUrl,
  isGoogleDriveUrl,
  memoriesService,
} from "../../services/memories.service";
import { MEMORY_TYPES } from "../../utils/constants";
import { useToast } from "../../context/ToastContext";
import { useBodyLock } from "../../hooks/useBodyLock";

export function MemoryUploadModal({ movieId, sortOffset, onClose, onSaved }) {
  const [source, setSource] = useState("upload");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(
    "Photos stay HD up to 3200 px. Videos are uploaded in their original quality.",
  );
  const [url, setUrl] = useState({
    link: "",
    type: "photo",
    date: "",
    caption: "",
  });
  const drafts = useMemoryDrafts();
  const toast = useToast();
  useBodyLock(true, "is-memory-modal-open");
  function files(event) {
    const selected = Array.from(event.target.files || []);
    const errors = drafts.addFiles(selected);
    event.target.value = "";
    setStatus(
      errors.length
        ? errors.join(" ")
        : `${drafts.drafts.length + selected.length} of ${drafts.maxFiles} media memories prepared.`,
    );
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }
    setSaving(true);
    try {
      if (source === "upload") {
        if (!drafts.drafts.length)
          throw new Error("Choose at least one photo or video.");
        let saved = 0;
        let failed = 0;
        const successful = [];
        for (let index = 0; index < drafts.drafts.length; index += 1) {
          const draft = drafts.drafts[index];
          drafts.update(draft.client_id, {
            status: "uploading",
            status_message: "Uploading to Cloudinary…",
          });
          setStatus(
            `Processing ${index + 1} of ${drafts.drafts.length}: ${draft.file.name}`,
          );
          try {
            await memoriesService.uploadDraft(
              draft,
              movieId,
              pin,
              sortOffset + index,
            );
            saved += 1;
            successful.push(draft.client_id);
          } catch (error) {
            failed += 1;
            drafts.update(draft.client_id, {
              status: "error",
              status_message: error.message,
            });
          }
        }
        successful.forEach(drafts.remove);
        if (saved) await onSaved();
        if (failed)
          toast(`${saved} saved, ${failed} need to be retried.`, "error");
        else {
          toast(`${saved} ${saved === 1 ? "memory" : "memories"} added.`);
          onClose();
        }
      } else {
        const parsed = new URL(url.link.trim());
        if (!["http:", "https:"].includes(parsed.protocol))
          throw new Error("Image URL must start with http:// or https://.");
        if (isGoogleDriveUrl(url.link) && !googleDriveFile(url.link))
          throw new Error(
            "Use a Google Drive file link, not a folder or Drive page link.",
          );
        await archiveService.writeAction(
          "createMemory",
          {
            memory: {
              movie_id: movieId,
              public_id: `url-${Date.now()}`,
              image_url: googleDriveImageUrl(url.link, { width: 3200 }),
              caption: url.caption.trim() || null,
              memory_type: url.type,
              memory_date: url.date || null,
              width: null,
              height: null,
              bytes: null,
              sort_order: sortOffset,
            },
          },
          pin,
        );
        await onSaved();
        toast("Memory added via URL.");
        onClose();
      }
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="memory-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-upload-title"
    >
      <button
        className="memory-lightbox-backdrop"
        type="button"
        aria-label="Close memory upload"
        disabled={saving}
        onClick={onClose}
      />
      <div className="memory-modal-dialog">
        <div className="memory-modal-header">
          <div>
            <h2 id="memory-upload-title">Add memories</h2>
            <p>
              Attach photos, short videos, tickets, posters, or screenshots.
            </p>
          </div>
          <button
            className="icon-button light-icon-button"
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="memory-source-switch">
            <label className="memory-source-choice">
              <input
                className="sr-only"
                type="radio"
                name="memorySource"
                value="upload"
                checked={source === "upload"}
                onChange={() => setSource("upload")}
              />
              <span className="memory-source-option">
                <UploadCloud aria-hidden="true" />
                <span>
                  <strong>Upload media</strong>
                  <small>Choose photos or videos from this device</small>
                </span>
              </span>
            </label>
            <label className="memory-source-choice">
              <input
                className="sr-only"
                type="radio"
                name="memorySource"
                value="url"
                checked={source === "url"}
                onChange={() => setSource("url")}
              />
              <span className="memory-source-option">
                <LinkIcon aria-hidden="true" />
                <span>
                  <strong>Paste a link</strong>
                  <small>Use an image URL or Google Drive file</small>
                </span>
              </span>
            </label>
          </div>
          {source === "upload" ? (
            <>
              <label className="memory-upload-dropzone">
                <Images aria-hidden="true" />
                <strong>Choose media</strong>
                <span>
                  JPEG, PNG, WebP, MP4, WebM, MOV, or M4V · max 15 MB each
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v"
                  multiple
                  disabled={saving}
                  onChange={files}
                />
              </label>
              <div className="memory-drafts">
                <MemoryDraftList manager={drafts} disabled={saving} />
              </div>
              <p className="memory-helper" role="status">
                {status}
              </p>
            </>
          ) : (
            <div className="form-grid">
              <label className="form-field is-full">
                <span>Image or Google Drive URL</span>
                <input
                  type="url"
                  required
                  value={url.link}
                  onChange={(e) =>
                    setUrl((v) => ({ ...v, link: e.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Type</span>
                <select
                  value={url.type}
                  onChange={(e) =>
                    setUrl((v) => ({ ...v, type: e.target.value }))
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
                <span>Date (optional)</span>
                <input
                  type="date"
                  value={url.date}
                  onChange={(e) =>
                    setUrl((v) => ({ ...v, date: e.target.value }))
                  }
                />
              </label>
              <label className="form-field is-full">
                <span>Caption (optional)</span>
                <input
                  maxLength="1000"
                  value={url.caption}
                  onChange={(e) =>
                    setUrl((v) => ({ ...v, caption: e.target.value }))
                  }
                />
              </label>
            </div>
          )}
          <div className="memory-modal-actions">
            <button
              className="text-button"
              type="button"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={`primary-button ${saving ? "is-loading" : ""}`}
              type="submit"
              disabled={saving}
            >
              <Upload aria-hidden="true" />
              {saving ? "Saving memory…" : "Save memories"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
