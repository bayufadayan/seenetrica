import { useEffect, useRef } from "react";

let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = undefined;
      reject(new Error("The YouTube Player API could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
export function useYouTubePlayer({ elementRef, videoId, volume, muted, onStarted, onEnded, onError }) {
  const playerRef = useRef(null);
  const callbacks = useRef({ onStarted, onEnded, onError });
  callbacks.current = { onStarted, onEnded, onError };
  const playback = useRef({ volume, muted });
  const forcedMuted = useRef(false);
  playback.current = { volume, muted };
  useEffect(() => {
    let active = true;
    let finished = false;
    let started = false;
    const finishWithError = () => {
      if (!active || finished) return;
      finished = true;
      callbacks.current.onError();
    };
    const watchdog = window.setTimeout(finishWithError, 8000);
    loadYouTubeApi().then((YT) => {
      if (!active || finished || !elementRef.current) return;
      playerRef.current = new YT.Player(elementRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          mute: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            event.target.mute();
            event.target.setVolume(playback.current.volume * 100);
            event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              if (!started) {
                started = true;
                window.clearTimeout(watchdog);
                callbacks.current.onStarted?.();
              }
              event.target.setVolume(playback.current.volume * 100);
              if (!playback.current.muted && !forcedMuted.current) event.target.unMute();
            } else if (event.data === YT.PlayerState.PAUSED && started) {
              forcedMuted.current = true;
              event.target.mute();
              event.target.playVideo();
            } else if (event.data === YT.PlayerState.ENDED && !finished) {
              finished = true;
              callbacks.current.onEnded();
            }
          },
          onError: finishWithError,
        },
      });
    }).catch(finishWithError);
    return () => {
      active = false;
      window.clearTimeout(watchdog);
      try { playerRef.current?.destroy?.(); } catch { /* The iframe may already have been removed. */ }
      playerRef.current = null;
    };
  }, [elementRef, videoId]);
  useEffect(() => { const player = playerRef.current; if (!player?.setVolume) return; player.setVolume(volume * 100); if (muted) player.mute(); else { forcedMuted.current = false; player.unMute(); } }, [muted, volume]);
  return playerRef;
}
