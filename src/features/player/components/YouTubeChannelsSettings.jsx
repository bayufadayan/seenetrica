import { RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { youtubeTrailerService } from "../services/youtube-trailer.service";
import { playerDb } from "../services/player-db.service";

export function YouTubeChannelsSettings({ channels, refresh, toast }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function refreshChannel(channel, quiet = false, force = !quiet) {
    try {
      const latestVideos = await youtubeTrailerService.getLatestVideos(channel.channelId, 10, force);
      await playerDb.updateYouTubeChannel(channel.id, { latestVideos, fetchedAt: new Date().toISOString() });
      await refresh();
      if (!quiet) toast("Trailer channel refreshed.");
    } catch (error) { if (!quiet) toast(error.message, "error"); }
  }
  async function add(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const resolved = await youtubeTrailerService.resolveChannel(url);
      const channel = await playerDb.saveYouTubeChannel({ ...resolved, channelUrl: url });
      await refreshChannel(channel, true, true);
      setUrl("");
      await refresh();
      toast("Trailer channel added.");
    } catch (error) { toast(error.message, "error"); } finally { setBusy(false); }
  }
  return <section className="wm-settings-section" id="youtube"><header><h2>Trailer Channels</h2></header><p>Use a YouTube channel URL or @handle. Latest embeddable videos are cached for six hours.</p><form className="wm-inline-form" onSubmit={add}><label className="form-field"><span>YouTube channel URL</span><input type="url" placeholder="https://www.youtube.com/@handle" value={url} onChange={(event) => setUrl(event.target.value)} required /></label><button className="primary-button" disabled={busy}>{busy ? "Adding…" : "Add channel"}</button></form><div className="wm-channel-list">{channels.map((channel) => <article key={channel.id}><img src={channel.thumbnailUrl} alt="" /><div><h3>{channel.title}</h3><p>{channel.latestVideos?.length || 0} cached videos</p><label className="checkbox-field"><input type="checkbox" checked={channel.enabled} onChange={async (event) => { await playerDb.updateYouTubeChannel(channel.id, { enabled: event.target.checked }); await refresh(); }} /> Enabled</label></div><div className="wm-card-actions"><button type="button" aria-label={`Refresh ${channel.title}`} onClick={() => refreshChannel(channel)}><RefreshCw aria-hidden="true" /></button><button type="button" aria-label={`Delete ${channel.title}`} onClick={async () => { await playerDb.deleteYouTubeChannel(channel.id); await refresh(); }}><Trash2 aria-hidden="true" /></button></div></article>)}{!channels.length && <p className="wm-empty-row">No trailer channels configured. Local ads and countdown still work.</p>}</div></section>;
}
