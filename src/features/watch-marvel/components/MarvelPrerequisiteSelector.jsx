import { Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

function titleMeta(title) {
  const record = title.seasonNumber ? `Season ${title.seasonNumber}` : null;
  return [title.type === "movie" ? "Movie" : "Series", record, title.releaseDate?.slice(0, 4) || "TBA"]
    .filter(Boolean)
    .join(" · ");
}

export function MarvelPrerequisiteSelector({ titles, value = [], onChange, excludeId, disabled = false }) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const choices = useMemo(() => titles
    .filter((title) => title.id !== excludeId)
    .filter((title) => `${title.title} ${title.baseTitle || ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => left.title.localeCompare(right.title)), [excludeId, query, titles]);

  function toggle(titleId, checked) {
    onChange(checked
      ? [...new Set([...value, titleId])]
      : value.filter((id) => id !== titleId));
  }

  return (
    <fieldset className="wm-prerequisite-selector" disabled={disabled}>
      <legend>Prerequisites (optional)</legend>
      <p>Only titles already saved in your Marvel Library can be selected.</p>
      <div className="wm-prerequisite-summary">
        <span>{value.length} selected</span>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])}>
            <X aria-hidden="true" /> Clear all
          </button>
        )}
      </div>
      <label className="wm-prerequisite-search" htmlFor={searchId}>
        <Search aria-hidden="true" />
        <input id={searchId} type="search" placeholder="Search saved titles" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="wm-prerequisite-options">
        {choices.map((title) => (
          <label key={title.id}>
            <input
              type="checkbox"
              checked={value.includes(title.id)}
              onChange={(event) => toggle(title.id, event.target.checked)}
            />
            <span><strong>{title.title}</strong><small>{titleMeta(title)}</small></span>
          </label>
        ))}
        {!choices.length && (
          <p className="wm-prerequisite-empty">
            {titles.some((title) => title.id !== excludeId)
              ? "No saved titles match this search."
              : "Add another title before setting prerequisites."}
          </p>
        )}
      </div>
    </fieldset>
  );
}
