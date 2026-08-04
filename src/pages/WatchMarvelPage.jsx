import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../context/ToastContext";
import { SurpriseModal } from "../features/watch-marvel/components/SurpriseModal";
import { WatchMarvelAnnouncement } from "../features/watch-marvel/components/WatchMarvelAnnouncement";
import { WatchMarvelHero } from "../features/watch-marvel/components/WatchMarvelHero";
import { useWatchMarvel } from "../features/watch-marvel/context/WatchMarvelProvider";
import { createBroadcastSession } from "../features/watch-marvel/services/broadcast-session.service";
import { pickUniqueRecommendation } from "../features/watch-marvel/utils/recommendation.util";

export default function WatchMarvelPage() {
  const { titles, settings, localSource, youtubeChannels, loading, error } = useWatchMarvel();
  const [history, setHistory] = useState([]);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  function openSurprise() {
    const first = pickUniqueRecommendation(titles);
    setHistory(first ? [first] : []);
    setSurpriseOpen(true);
  }
  async function play(title) {
    setBusy(true);
    try {
      const session = await createBroadcastSession({ title, settings, localSource, channels: youtubeChannels });
      if (!session.fileRecoverable) toast("This browser will ask for the same movie file again after a refresh.");
      navigate(`/watch-marvel/player/${session.id}`);
    } catch (nextError) {
      if (nextError.name !== "AbortError") toast(nextError.message, "error");
      setBusy(false);
    }
  }
  if (loading) return <main className="page-shell wm-page"><LoadingState>Opening the broadcast archive…</LoadingState></main>;
  if (error) return <main className="page-shell wm-page"><ErrorState>{error.message}</ErrorState></main>;
  return (
    <main className="page-shell wm-page">
      <WatchMarvelAnnouncement />
      <WatchMarvelHero titles={titles} onSurprise={openSurprise} />
      {surpriseOpen && <SurpriseModal titles={titles} history={history} setHistory={setHistory} busy={busy} onClose={() => { setHistory([]); setSurpriseOpen(false); }} onPlay={play} />}
    </main>
  );
}
