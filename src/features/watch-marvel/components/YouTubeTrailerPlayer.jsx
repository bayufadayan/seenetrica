import { useRef, useState } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
export function YouTubeTrailerPlayer({ item, volume, muted, onEnded }) {
  const ref = useRef(null);
  const [started, setStarted] = useState(false);
  useYouTubePlayer({ elementRef: ref, videoId: item.videoId, volume, muted, onStarted: () => setStarted(true), onEnded, onError: onEnded });
  return (
    <div className="wm-youtube-shell" aria-label={`Trailer: ${item.title}`}>
      <div ref={ref} />
      {!started && <div className="wm-youtube-loading"><span>Loading trailer</span><strong>{item.title}</strong></div>}
    </div>
  );
}
