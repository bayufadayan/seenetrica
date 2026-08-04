import { useRef } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
export function YouTubeTrailerPlayer({ item, volume, muted, onEnded }) { const ref = useRef(null); useYouTubePlayer({ elementRef: ref, videoId: item.videoId, volume, muted, onEnded, onError: onEnded }); return <div className="wm-youtube-frame" ref={ref} aria-label={`Trailer: ${item.title}`} />; }
