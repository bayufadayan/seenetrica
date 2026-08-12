import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../context/ToastContext";
import { CategoryHero } from "../features/categories/components/CategoryHero";
import { LegacyMarvelDataPanel } from "../features/categories/components/LegacyMarvelDataPanel";
import { CategorySurpriseModal } from "../features/categories/components/CategorySurpriseModal";
import { CategorySyncStatus } from "../features/categories/components/CategorySyncStatus";
import { useCategories } from "../features/categories/context/CategoriesProvider";
import { pickUniqueRecommendation } from "../features/categories/utils/recommendation.util";
import { usePlayerSettings } from "../features/player/context/PlayerProvider";
import { createBroadcastSession } from "../features/player/services/broadcast-session.service";

export default function CategoryPage() {
  const { categorySlug } = useParams();
  const categories = useCategories();
  const player = usePlayerSettings();
  const category = categories.categories.find((item) => item.slug === categorySlug);
  const titles = category
    ? categories.titles.filter((title) => title.categoryId === category.id)
    : [];
  const [history, setHistory] = useState([]);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function play(title) {
    setBusy(true);
    try {
      const session = await createBroadcastSession({
        sourceKind: "category",
        title,
        category,
        settings: player.settings,
        localSource: player.localSource,
        channels: player.youtubeChannels,
      });
      if (!session.fileRecoverable) {
        toast("This browser will ask for the same movie file again after a refresh.");
      }
      navigate(`/watch-anything/player/${session.id}`);
    } catch (error) {
      if (error.name !== "AbortError") toast(error.message, "error");
      setBusy(false);
    }
  }

  if ((categories.loading || player.loading) && !category) {
    return <main className="page-shell wm-page"><LoadingState>Opening category…</LoadingState></main>;
  }
  if (!category) {
    return <main className="page-shell wm-page"><ErrorState>This category could not be found.</ErrorState></main>;
  }
  if (player.error || !player.settings) {
    return <main className="page-shell wm-page"><ErrorState>{player.error?.message || "Player settings are unavailable."}</ErrorState></main>;
  }

  return (
    <main className="page-shell wm-page">
      <div className="category-page-status">
        <aside className="wm-announcement" aria-label="Local playback notice">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Local playback only — media stays on this device.</strong>
            <span>Category records sync separately; video and subtitle files are never uploaded.</span>
          </p>
        </aside>
        <CategorySyncStatus />
      </div>
      {category.slug === "marvel" && (
        <LegacyMarvelDataPanel category={category} onCompleted={categories.refreshLocal} />
      )}
      <CategoryHero
        category={category}
        titles={titles}
        onSurprise={() => {
          const first = pickUniqueRecommendation(titles);
          setHistory(first ? [first] : []);
          setSurpriseOpen(true);
        }}
      />
      {surpriseOpen && (
        <CategorySurpriseModal
          category={category}
          titles={titles}
          history={history}
          setHistory={setHistory}
          busy={busy}
          onClose={() => { setHistory([]); setSurpriseOpen(false); }}
          onPlay={play}
        />
      )}
    </main>
  );
}
