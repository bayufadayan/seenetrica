import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AddMovieHero } from "../features/movies/add-movie/AddMovieHero";
import { BulkMovieMode } from "../features/movies/add-movie/BulkMovieMode";
import { SaveOverlay } from "../features/movies/add-movie/SaveOverlay";
import { SingleMovieMode } from "../features/movies/add-movie/SingleMovieMode";
import { getLaunchPreset } from "../features/movies/add-movie/addMovie.utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function AddMoviePage() {
  useDocumentTitle("Add movies");

  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("single");
  const [saveProgress, setSaveProgress] = useState(null);
  const preset = useMemo(
    () => getLaunchPreset(searchParams),
    [searchParams],
  );

  function toggleMode() {
    setMode((currentMode) =>
      currentMode === "single" ? "bulk" : "single",
    );
  }

  return (
    <>
      <AddMovieHero mode={mode} preset={preset} onToggleMode={toggleMode} />
      {mode === "single" ? (
        <SingleMovieMode preset={preset} onProgress={setSaveProgress} />
      ) : (
        <BulkMovieMode onProgress={setSaveProgress} />
      )}
      <SaveOverlay progress={saveProgress} />
    </>
  );
}
