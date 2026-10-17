import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { findMoviesByIdentity, findMoviesWithSameTitle } from "../movie-identity.util";
import { useArchive } from "../../../context/ArchiveContext";
import { useToast } from "../../../context/ToastContext";
import { useMemoryDrafts } from "../../memories/useMemoryDrafts";
import { archiveService } from "../../../services/archive.service";
import { memoriesService } from "../../../services/memories.service";
import { useSpeechRecognition } from "../useSpeechRecognition";
import {
  createEmptyMovieForm,
  createMovieDetailsPath,
  createMovieForm,
  createMoviePayload,
} from "./addMovie.utils";

export function useSingleMovieEntry({ preset, onProgress }) {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [form, setForm] = useState(() => createEmptyMovieForm(preset));
  const [saving, setSaving] = useState(false);
  const submitGuard = useRef(false);
  const drafts = useMemoryDrafts();
  const { movies, refresh } = useArchive();
  const [allowSameTitle, setAllowSameTitle] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const updateReview = useCallback((review) => {
    setForm((current) => ({ ...current, review }));
  }, []);

  const reportSpeechError = useCallback(
    (message) => toast(message, "error"),
    [toast],
  );

  const speech = useSpeechRecognition(
    form.review,
    updateReview,
    reportSpeechError,
  );

  function selectMovie(movie) {
    speech.stop();
    drafts.clear();
    setSelectedMovie(movie);
    setAllowSameTitle(false);
    setForm(createMovieForm(movie, preset));
  }

  function clearSelection() {
    speech.stop();
    drafts.clear();
    setSelectedMovie(null);
    setAllowSameTitle(false);
    setForm(createEmptyMovieForm(preset));
  }

  function updateField(name, value) {
    if (name === "title") setAllowSameTitle(false);
    setForm((current) => ({ ...current, [name]: value }));
  }

  const existingMatches = selectedMovie
    ? findMoviesByIdentity(movies, selectedMovie)
    : [];
  const sameTitleMatches = selectedMovie && !existingMatches.length
    ? findMoviesWithSameTitle(movies, form.title)
    : [];

  async function submit(event) {
    event.preventDefault();
    if (submitGuard.current) return;
    if (existingMatches.length) {
      toast("This title is already in the library. Open the existing movie instead.", "error");
      return;
    }
    if (sameTitleMatches.length && !allowSameTitle) {
      toast("Review the matching titles before saving a separate movie.", "error");
      return;
    }

    await speech.stop();

    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }

    submitGuard.current = true;
    setSaving(true);
    onProgress({
      message: "Saving your movie to Seenetrica…",
      detail: "Please keep this page open.",
    });

    try {
      const result = await saveMovie(pin);
      if (!result.created) {
        await refresh();
        toast("This movie already exists in your library. No new record was created.");
        navigate(`/movies/${encodeURIComponent(result.movie.id)}`);
        return;
      }
      const mediaResult = await saveMemories(result.movie.id, pin);

      await refresh();
      showSuccessMessage(mediaResult);
      navigate(createMovieDetailsPath(result.movie.id, mediaResult));
    } catch (error) {
      toast(error.message, "error");
      onProgress(null);
      setSaving(false);
      submitGuard.current = false;
    }
  }

  async function saveMovie(pin) {
    const result = await archiveService.writeAction(
      "createMovie",
      {
        movie: createMoviePayload(form, selectedMovie),
        allow_same_title: allowSameTitle,
      },
      pin,
    );

    return result;
  }

  async function saveMemories(movieId, pin) {
    if (!drafts.drafts.length) return { saved: [], failures: [] };

    const saved = [];
    const failures = [];

    for (let index = 0; index < drafts.drafts.length; index += 1) {
      const draft = drafts.drafts[index];
      markDraftAsPreparing(draft, index);

      try {
        const memory = await memoriesService.uploadDraft(
          draft,
          movieId,
          pin,
          index,
        );
        saved.push(memory);
        drafts.update(draft.client_id, {
          status: "done",
          status_message: "Saved",
        });
      } catch (error) {
        failures.push(error);
        drafts.update(draft.client_id, {
          status: "error",
          status_message: error.message,
        });
      }
    }

    return { saved, failures };
  }

  function markDraftAsPreparing(draft, index) {
    drafts.update(draft.client_id, {
      status: "preparing",
      status_message: "Preparing media…",
    });
    onProgress({
      message: `Preparing memory ${index + 1} of ${drafts.drafts.length}…`,
      detail: draft.file.name,
    });
  }

  function showSuccessMessage(mediaResult) {
    const hasFailures = mediaResult.failures.length > 0;

    toast(
      hasFailures
        ? "Movie saved. Some memories need to be retried."
        : "Movie added to Seenetrica.",
      hasFailures ? "error" : "success",
    );
  }

  return {
    selectedMovie,
    form,
    saving,
    drafts,
    speech,
    selectMovie,
    clearSelection,
    updateField,
    submit,
    existingMatches,
    sameTitleMatches,
    allowSameTitle,
    setAllowSameTitle,
  };
}
