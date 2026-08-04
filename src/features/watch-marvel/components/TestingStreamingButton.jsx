import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBroadcastSession } from "../services/broadcast-session.service";

export function TestingStreamingButton({ settings, localSource, channels, toast }) {
  const [busy, setBusy] = useState(false); const navigate = useNavigate();
  async function start() { setBusy(true); try { const session = await createBroadcastSession({ mode: "test", settings, localSource, channels }); navigate(`/watch-marvel/player/${session.id}`); } catch (error) { if (error.name !== "AbortError") toast(error.message, "error"); setBusy(false); } }
  return <section className="wm-settings-section" id="testing"><header><h2>Testing Streaming</h2></header><p>Run the same player with a 20-second pre-show, an early commercial break, and no changes to watched status.</p><button className="primary-button" type="button" disabled={busy} onClick={start}><FlaskConical /> {busy ? "Reading video…" : "Testing Streaming"}</button></section>;
}
