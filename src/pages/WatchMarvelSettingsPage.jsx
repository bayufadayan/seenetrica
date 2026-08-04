import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../context/ToastContext";
import { BroadcastSettings } from "../features/watch-marvel/components/BroadcastSettings";
import { LocalAdsSettings } from "../features/watch-marvel/components/LocalAdsSettings";
import { MarvelLibraryManager } from "../features/watch-marvel/components/MarvelLibraryManager";
import { TestingStreamingButton } from "../features/watch-marvel/components/TestingStreamingButton";
import { YouTubeChannelsSettings } from "../features/watch-marvel/components/YouTubeChannelsSettings";
import { useWatchMarvel } from "../features/watch-marvel/context/WatchMarvelProvider";
import { watchMarvelDb } from "../features/watch-marvel/services/watch-marvel-db.service";

const nav = [["library", "Marvel Library"], ["local-ads", "Local Advertisements"], ["youtube", "Trailer Channels"], ["pre-show", "Pre-show"], ["breaks", "Commercial Breaks"], ["testing", "Testing Streaming"]];
export default function WatchMarvelSettingsPage() {
  const data = useWatchMarvel(); const toast = useToast(); const [draft, setDraft] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data.settings) setDraft(structuredClone(data.settings)); }, [data.settings]);
  if (data.loading || !draft) return <main className="page-shell wm-page"><LoadingState>Loading Watch Marvel settings…</LoadingState></main>;
  if (data.error) return <main className="page-shell wm-page"><ErrorState>{data.error.message}</ErrorState></main>;
  async function save(event) { event.preventDefault(); setBusy(true); try { const saved = await watchMarvelDb.saveSettings(draft); setDraft(saved); await data.refresh(); toast("Broadcast settings saved."); } catch (error) { toast(error.message, "error"); } finally { setBusy(false); } }
  return <main className="page-shell wm-settings-page"><div className="wm-settings-heading"><h1>Broadcast settings</h1><p>Manage the archive and shape what plays before and during a local feature.</p><Link to="/watch-marvel">Back to dashboard</Link></div><div className="wm-settings-layout"><nav className="wm-settings-nav" aria-label="Settings sections">{nav.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav><div className="wm-settings-content"><MarvelLibraryManager titles={data.titles} refresh={data.refresh} toast={toast} /><LocalAdsSettings source={data.localSource} refresh={data.refresh} toast={toast} /><YouTubeChannelsSettings channels={data.youtubeChannels} refresh={data.refresh} toast={toast} /><BroadcastSettings settings={draft} setSettings={setDraft} onSave={save} busy={busy} /><TestingStreamingButton settings={draft} localSource={data.localSource} channels={data.youtubeChannels} toast={toast} /></div></div></main>;
}
