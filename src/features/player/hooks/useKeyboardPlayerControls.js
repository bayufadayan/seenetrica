import { useCallback, useEffect } from "react";

export function useKeyboardPlayerControls({ volume, setVolume, muted, setMuted, containerRef }) {
  const toggleFullscreen = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await containerRef.current?.requestFullscreen(); } catch { /* Fullscreen can be rejected by browser policy. */ }
  }, [containerRef]);
  useEffect(() => {
    const keydown = (event) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "+", "=", "arrowdown", "-", "m", "f"].includes(key)) event.preventDefault();
      if (["arrowup", "+", "="].includes(key)) setVolume(Math.min(1, volume + 0.05));
      if (["arrowdown", "-"].includes(key)) setVolume(Math.max(0, volume - 0.05));
      if (key === "m") setMuted(!muted);
      if (key === "f") toggleFullscreen();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [muted, setMuted, setVolume, toggleFullscreen, volume]);
  return toggleFullscreen;
}
