import { Layers3, SquarePlus } from "lucide-react";
import { formatMonth } from "../../../utils/formatters";

export function AddMovieHero({ mode, preset, onToggleMode }) {
  const isBulkMode = mode === "bulk";

  return (
    <section className="page-hero page-shell add-page-hero">
      <div>
        <h1>
          Add a <span>title.</span>
        </h1>
        <p className="page-hero-description">
          {getDescription(mode, preset)}
        </p>
      </div>

      <div className="add-mode-action">
        <button
          className="secondary-button add-mode-toggle"
          type="button"
          aria-pressed={isBulkMode}
          onClick={onToggleMode}
        >
          {isBulkMode ? (
            <SquarePlus aria-hidden="true" />
          ) : (
            <Layers3 aria-hidden="true" />
          )}
          <span>{isBulkMode ? "Add one title" : "Add movies by month"}</span>
        </button>
        <p>
          {isBulkMode
            ? "Return to the regular form for a single detailed entry."
            : "Useful when you want to backfill several titles from the same month."}
        </p>
      </div>
    </section>
  );
}

function getDescription(mode, preset) {
  if (mode === "bulk") {
    return "Choose a month, build a list from TMDB, review it, then save everything together.";
  }
  if (preset.inTheater) {
    return "Search a title and it will be prepared as a theater viewing for today.";
  }
  if (preset.period) {
    return `Add a watched title to ${formatMonth(preset.period)}. Choose the exact day before saving.`;
  }

  return "Search TMDB for the basic details, then make the entry yours.";
}
