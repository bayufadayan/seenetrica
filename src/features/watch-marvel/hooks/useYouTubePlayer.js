import { useEffect, useRef } from "react";

let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true; document.head.appendChild(script);
  });
  return apiPromise;
}
export function useYouTubePlayer({ elementRef, videoId, volume, muted, onEnded, onError }) {
  const playerRef = useRef(null);
  const callbacks = useRef({ onEnded, onError });
  callbacks.current = { onEnded, onError };
  const playback = useRef({ volume, muted });
  playback.current = { volume, muted };
  useEffect(() => {
    let active = true;
    loadYouTubeApi().then((YT) => { if (!active || !elementRef.current) return; playerRef.current = new YT.Player(elementRef.current, { videoId, playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0 }, events: { onReady: (event) => { event.target.setVolume(playback.current.volume * 100); if (playback.current.muted) event.target.mute(); event.target.playVideo(); }, onStateChange: (event) => { if (event.data === YT.PlayerState.ENDED) callbacks.current.onEnded(); }, onError: () => callbacks.current.onError() } }); }).catch(() => callbacks.current.onError());
    return () => { active = false; playerRef.current?.destroy?.(); playerRef.current = null; };
  }, [elementRef, videoId]);
  useEffect(() => { const player = playerRef.current; if (!player?.setVolume) return; player.setVolume(volume * 100); muted ? player.mute() : player.unMute(); }, [muted, volume]);
  return playerRef;
}
