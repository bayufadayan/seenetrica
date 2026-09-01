import { Images } from "lucide-react";
import { useState } from "react";
import { MemoryDraftList } from "../../memories/MemoryDraftList";

const INITIAL_STATUS =
  "Photos stay HD up to 3200 px. Videos are uploaded in their original quality.";

export function MemoryAttachmentFields({ drafts, saving }) {
  const [status, setStatus] = useState(INITIAL_STATUS);

  function selectFiles(event) {
    const selectedFiles = Array.from(event.target.files || []);
    const errors = drafts.addFiles(selectedFiles);
    const preparedCount = Math.min(
      drafts.drafts.length + selectedFiles.length,
      drafts.maxFiles,
    );

    event.target.value = "";
    setStatus(
      errors.length
        ? errors.join(" ")
        : `${preparedCount} of ${drafts.maxFiles} media memories prepared.`,
    );
  }

  const hasError = status.includes("larger") || status.includes("Only");

  return (
    <section className="memory-entry-block" aria-labelledby="add-memory-heading">
      <div className="memory-entry-heading">
        <div>
          <h3 id="add-memory-heading">Add media from this experience</h3>
          <p>
            Tickets, cinema photos, short videos, posters, or screenshots. The
            movie is saved first, then this media is attached to it.
          </p>
        </div>
        <label className="secondary-button memory-file-button">
          <Images aria-hidden="true" />
          Choose media
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v"
            multiple
            disabled={saving}
            onChange={selectFiles}
          />
        </label>
      </div>

      <div className="memory-drafts">
        <MemoryDraftList manager={drafts} disabled={saving} />
      </div>

      <p
        className={`memory-helper ${hasError ? "is-error" : ""}`}
        role="status"
      >
        {status}
      </p>
    </section>
  );
}
