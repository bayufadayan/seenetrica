import { ShieldCheck } from "lucide-react";

export function WatchMarvelAnnouncement() {
  return (
    <aside className="wm-announcement" aria-label="Local playback notice">
      <ShieldCheck aria-hidden="true" />
      <p><strong>Local playback only — your media stays on this device.</strong><span>Titles and settings are stored in this browser. Video files are never uploaded.</span></p>
    </aside>
  );
}
