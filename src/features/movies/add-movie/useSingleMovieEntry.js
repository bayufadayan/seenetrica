import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  createViewingPayload,
} from "./addMovie.utils";

export function useSingleMovieEntry({ preset, onProgress }) {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [form, setForm] = useState(() => createEmptyMovieForm(preset));
  const [saving, setSaving] = useState(false);
  const submitGuard = useRef(false);
  const drafts = useMemoryDrafts();
  const { refresh } = useArchive();
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
    setForm(createMovieForm(movie, preset));
  }

  function clearSelection() {
    speech.stop();
    drafts.clear();
    setSelectedMovie(null);
    setForm(createEmptyMovieForm(preset));
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitGuard.current) return;

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
      const savedMovie = await saveMovie(pin);
      const mediaResult = await saveMemories(savedMovie.id, pin);

      await refresh();
      showSuccessMessage(mediaResult);
      navigate(createMovieDetailsPath(savedMovie.id, mediaResult));
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
        viewing: createViewingPayload(form),
      },
      pin,
    );

    return result.movie;
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
  };
}
