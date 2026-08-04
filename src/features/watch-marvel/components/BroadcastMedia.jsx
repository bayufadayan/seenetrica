import { useEffect, useState } from "react";
import { localMediaService } from "../services/local-media.service";
import { YouTubeTrailerPlayer } from "./YouTubeTrailerPlayer";

function TimedFallback({ seconds, onEnded }) {
  const [remaining, setRemaining] = useState(Math.ceil(seconds));
  useEffect(() => { const target = Date.now() + seconds * 1000; const update = () => { const next = Math.max(0, Math.ceil((target - Date.now()) / 1000)); setRemaining(next); if (!next) onEnded(); }; const id = window.setInterval(update, 250); update(); return () => window.clearInterval(id); }, [onEnded, seconds]);
  return <div className="wm-media-fallback"><span>Broadcast resumes shortly</span><strong>{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</strong></div>;
}

function LocalAd({ source, item, volume, muted, onEnded }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let active = true; let objectUrl; localMediaService.resolveAdFile(source, item).then((file) => { if (!active) return; objectUrl = URL.createObjectURL(file); setUrl(objectUrl); }).catch(onEnded); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [item, onEnded, source]);
  if (!url) return <div className="wm-media-fallback"><span>Loading local advertisement…</span></div>;
  return <video className="wm-ad-video" src={url} autoPlay playsInline disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" volume={volume} muted={muted} onEnded={onEnded} onError={onEnded} />;
}

export function BroadcastMedia({ item, source, volume, muted, onEnded }) {
  if (!item || item.kind === "countdown") return <TimedFallback seconds={item?.durationSeconds || 10} onEnded={onEnded} />;
  if (item.kind === "youtube") return <YouTubeTrailerPlayer item={item} volume={volume} muted={muted} onEnded={onEnded} />;
  return <LocalAd source={source} item={item} volume={volume} muted={muted} onEnded={onEnded} />;
}
