import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AddMovieHero } from "../features/movies/add-movie/AddMovieHero";
import { SaveOverlay } from "../features/movies/add-movie/SaveOverlay";
import { SingleMovieMode } from "../features/movies/add-movie/SingleMovieMode";
import { getLaunchPreset } from "../features/movies/add-movie/addMovie.utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function AddMoviePage() {
  useDocumentTitle("Add Movie");
  const [searchParams] = useSearchParams();
  const [saveProgress, setSaveProgress] = useState(null);
  const preset = useMemo(() => getLaunchPreset(searchParams), [searchParams]);
  const needsViewing = preset.status === "watched" || preset.inTheater || preset.period;

  if (needsViewing) {
    return <Navigate replace to={`/log-viewing?${searchParams.toString()}`} />;
  }

  return (
    <>
      <AddMovieHero mode="single" preset={preset} />
      <SingleMovieMode preset={preset} onProgress={setSaveProgress} />
      <SaveOverlay progress={saveProgress} />
    </>
  );
}
