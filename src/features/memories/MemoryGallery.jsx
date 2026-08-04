import { Images, Play } from "lucide-react";
import {
  cloudinaryImageUrl,
  cloudinaryVideoPosterUrl,
  isVideoMemory,
} from "../../services/memories.service";
import { formatDate } from "../../utils/formatters";
import { Poster } from "../../components/ui/Poster";

export function MemoryGallery({ memories, onAdd, onOpen }) {
  return (
    <section className="memories-block">
      <div className="memories-heading">
        <div>
          <h2>Memories</h2>
          <p className="memory-count">
            {memories.length} {memories.length === 1 ? "memory" : "memories"}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onAdd}>
          <Images aria-hidden="true" />
          Add memories
        </button>
      </div>
      <div className="memory-gallery">
        {memories.length ? (
          memories.map((memory) => {
            const video = isVideoMemory(memory);
            const source = video
              ? cloudinaryVideoPosterUrl(memory.image_url, {
                  width: 720,
                  height: 720,
                  crop: "fill",
                  gravity: "auto",
                })
              : cloudinaryImageUrl(memory.image_url, {
                  width: 720,
                  height: 720,
                  crop: "fill",
                  gravity: "auto",
                });
            const caption = memory.caption || "A memory from this title";
            return (
              <article className="memory-card" key={memory.id}>
                <button
                  className="memory-card-button"
                  type="button"
                  onClick={() => onOpen(memory)}
                  aria-label={`Open memory: ${caption}`}
                >
                  <div className="memory-card-image">
                    <Poster src={source} alt={caption} loading="lazy" />
                    {video && (
                      <span
                        className="memory-video-indicator"
                        aria-hidden="true"
                      >
                        <Play />
                      </span>
                    )}
                    <span className="memory-type-badge">
                      {video ? "video" : memory.memory_type || "photo"}
                    </span>
                  </div>
                  <div className="memory-card-copy">
                    <strong>{caption}</strong>
                    <span>
                      {formatDate(memory.memory_date, {
                        fallback: "Date not set",
                      })}
                    </span>
                  </div>
                </button>
              </article>
            );
          })
        ) : (
          <div className="memory-gallery-empty">
            <p>No personal memories have been attached to this title yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
