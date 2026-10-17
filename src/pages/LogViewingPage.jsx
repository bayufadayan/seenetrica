import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BulkMovieMode } from "../features/movies/add-movie/BulkMovieMode";
import { SaveOverlay } from "../features/movies/add-movie/SaveOverlay";
import { LogViewingSingleMode } from "../features/movies/log-viewing/LogViewingSingleMode";
import { getLaunchPreset } from "../features/movies/add-movie/addMovie.utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function LogViewingPage() {
  useDocumentTitle("Log a Viewing");
  const [searchParams] = useSearchParams();
  const preset = useMemo(() => getLaunchPreset(searchParams), [searchParams]);
  const [bulk, setBulk] = useState(false);
  const [progress, setProgress] = useState(null);

  return (
    <>
      <section className="page-hero page-shell add-page-hero">
        <div>
          <h1>Log a <span>viewing.</span></h1>
          <p className="page-hero-description">Choose a title already in your library or find it on TMDB, then record when and where you watched it.</p>
        </div>
        <div className="add-mode-action">
          <button className="secondary-button add-mode-toggle" type="button" aria-pressed={bulk} onClick={() => setBulk((value) => !value)}>
            {bulk ? "Log one viewing" : "Log viewings by month"}
          </button>
        </div>
      </section>
      {bulk ? <BulkMovieMode onProgress={setProgress} /> : <LogViewingSingleMode preset={preset} requestedMovieId={searchParams.get("movie_id")} onProgress={setProgress} />}
      <SaveOverlay progress={progress} />
    </>
  );
}
