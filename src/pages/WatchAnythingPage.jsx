import { Play, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../context/ToastContext";
import { TestingStreamingButton } from "../features/player/components/TestingStreamingButton";
import { usePlayerSettings } from "../features/player/context/PlayerProvider";
import { createBroadcastSession } from "../features/player/services/broadcast-session.service";
import { playerDb } from "../features/player/services/player-db.service";
import { BroadcastSettings } from "../features/player/components/BroadcastSettings";
import { LocalAdsSettings } from "../features/player/components/LocalAdsSettings";
import { YouTubeChannelsSettings } from "../features/player/components/YouTubeChannelsSettings";

const nav = [["local-ads", "Local Advertisements"], ["youtube", "Trailer Channels"], ["pre-show", "Pre-show"], ["breaks", "Commercial Breaks"], ["testing", "Testing Streaming"]];

export default function WatchAnythingPage() {
  const data = usePlayerSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [playBusy, setPlayBusy] = useState(false);
  useEffect(() => { if (data.settings) setDraft(structuredClone(data.settings)); }, [data.settings]);

  async function start() {
    setPlayBusy(true);
    try {
      const session = await createBroadcastSession({ sourceKind: "anything", settings: draft, localSource: data.localSource, channels: data.youtubeChannels });
      navigate(`/watch-anything/player/${session.id}`);
    } catch (error) {
      if (error.name !== "AbortError") toast(error.message, "error");
      setPlayBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try { const saved = await playerDb.saveSettings(draft); setDraft(saved); await data.refresh(); toast("Global player settings saved on this device."); } catch (error) { toast(error.message, "error"); } finally { setBusy(false); }
  }

  if (data.loading || !draft) return <main className="page-shell wm-page"><LoadingState>Loading player settings…</LoadingState></main>;
  if (data.error) return <main className="page-shell wm-page"><ErrorState>{data.error.message}</ErrorState></main>;
  return <main className="page-shell wm-settings-page watch-anything-page"><section className="watch-anything-hero"><div><span>Local feature presentation</span><h1>Watch <em>Anything.</em></h1><p>Choose a movie file outside your categories and use the same trailers, advertisements, countdown, subtitles, and keyboard controls.</p><button className="primary-button" type="button" disabled={playBusy} onClick={start}><Play aria-hidden="true" /> {playBusy ? "Reading video…" : "Choose local movie"}</button></div><aside><ShieldCheck aria-hidden="true" /><strong>Your media stays local.</strong><p>Movie, advertisement, and subtitle files are never uploaded. Watch Anything sessions do not create main History entries.</p></aside></section><div className="wm-settings-heading"><h2>Global player settings</h2><p>These settings apply to every category and Watch Anything on this device. They are not synced to the Spreadsheet.</p></div><div className="wm-settings-layout"><nav className="wm-settings-nav" aria-label="Player settings sections">{nav.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav><div className="wm-settings-content"><LocalAdsSettings source={data.localSource} refresh={data.refresh} toast={toast} /><YouTubeChannelsSettings channels={data.youtubeChannels} refresh={data.refresh} toast={toast} /><BroadcastSettings settings={draft} setSettings={setDraft} onSave={save} busy={busy} /><TestingStreamingButton settings={draft} localSource={data.localSource} channels={data.youtubeChannels} toast={toast} /></div></div></main>;
}
