import { useMemo, useState } from "react";
import { createSeasonDrafts } from "../utils/title-draft.util";

export function MarvelSeasonRangeForm({ details, existingIdentityKeys = new Set(), onConfirm, onCancel, busy = false, actionLabel = "Save seasons" }) {
  const regularSeasons = (details.seasons || []).filter((season) => Number(season.season_number) > 0);
  const maximum = Math.max(0, Number(details.number_of_seasons) || 0, ...regularSeasons.map((season) => Number(season.season_number) || 0));
  const [firstSeason, setFirstSeason] = useState(1);
  const [lastSeason, setLastSeason] = useState(maximum || 1);
  const preview = useMemo(() => {
    try {
      const drafts = createSeasonDrafts(details, firstSeason, lastSeason);
      return { drafts, error: "" };
    } catch (error) {
      return { drafts: [], error: error.message };
    }
  }, [details, firstSeason, lastSeason]);
  const available = preview.drafts.filter((draft) => !existingIdentityKeys.has(draft.identityKey));

  return (
    <div className="wm-season-range">
      <div className="selected-preview wm-season-series-preview">
        <div><h3>{details.title}</h3><p>{maximum ? `${maximum} regular season${maximum === 1 ? "" : "s"} available` : "Season data unavailable"}</p></div>
      </div>
      <div className="form-grid">
        <label className="form-field"><span>First season</span><input type="number" min="1" max={maximum || undefined} value={firstSeason} onChange={(event) => setFirstSeason(Number(event.target.value))} /></label>
        <label className="form-field"><span>Last season</span><input type="number" min={Math.max(1, firstSeason)} max={maximum || undefined} value={lastSeason} onChange={(event) => setLastSeason(Number(event.target.value))} /></label>
      </div>
      {preview.error ? <p className="wm-field-error" role="alert">{preview.error}</p> : (
        <div className="wm-season-preview">
          <strong>Records</strong>
          <ul>{preview.drafts.map((draft) => (
            <li className={existingIdentityKeys.has(draft.identityKey) ? "is-duplicate" : ""} key={draft.identityKey}>
              <span>{draft.title}</span>
              {existingIdentityKeys.has(draft.identityKey) && <small>Already added</small>}
            </li>
          ))}</ul>
        </div>
      )}
      {!preview.error && !available.length && <p className="wm-field-error" role="status">All seasons in this range are already added.</p>}
      <div className="form-actions">
        <button className="primary-button" type="button" disabled={busy || !available.length || Boolean(preview.error)} onClick={() => onConfirm(available)}>
          {busy ? "Savingâ€¦" : actionLabel}
        </button>
        <button className="text-button" type="button" disabled={busy} onClick={onCancel}>Back to search</button>
      </div>
    </div>
  );
}
