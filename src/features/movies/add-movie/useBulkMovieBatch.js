import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArchive } from "../../../context/ArchiveContext";
import { useToast } from "../../../context/ToastContext";
import { archiveService } from "../../../services/archive.service";
import { createBatchItem, createBatchPayload } from "./addMovie.utils";

export function useBulkMovieBatch({ onProgress }) {
  const [period, setPeriod] = useState("");
  const [queue, setQueue] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useArchive();

  function addMovie(movie) {
    const duplicate = queue.some(
      (item) =>
        item.external_source === movie.external_source &&
        Number(item.external_id) === Number(movie.external_id) &&
        item.media_type === movie.media_type,
    );

    if (duplicate) {
      toast(`${movie.title} is already in this batch.`, "error");
      return;
    }

    setQueue((currentQueue) => [
      ...currentQueue,
      createBatchItem(movie),
    ]);
    toast(`${movie.title} added to the batch.`);
  }

  function changePeriod(nextPeriod) {
    const periodChanged = period && nextPeriod !== period;
    const hasExactDates = queue.some((item) => item.watched_at);

    if (periodChanged && hasExactDates) {
      clearDatesOutsidePeriod(nextPeriod);
      toast(
        "Exact dates outside the new month were cleared. Review the pencil fields if needed.",
      );
    }

    setPeriod(nextPeriod);
  }

  function clearDatesOutsidePeriod(nextPeriod) {
    setQueue((currentQueue) =>
      currentQueue.map((item) => ({
        ...item,
        watched_at: item.watched_at.startsWith(`${nextPeriod}-`)
          ? item.watched_at
          : "",
      })),
    );
  }

  function removeMovie(clientId) {
    setQueue((currentQueue) =>
      currentQueue.filter((item) => item.client_id !== clientId),
    );
  }

  function clearQueue() {
    const confirmed = window.confirm(
      "Remove every title from this batch? Nothing has been saved yet.",
    );
    if (confirmed) setQueue([]);
  }

  function openEditor(item) {
    setEditingItem({ ...item });
  }

  function closeEditor() {
    setEditingItem(null);
  }

  function updateMovie(nextItem) {
    setQueue((currentQueue) =>
      currentQueue.map((item) =>
        item.client_id === nextItem.client_id ? nextItem : item,
      ),
    );
    setEditingItem(null);
    toast(`${nextItem.title} updated.`);
  }

  async function saveBatch() {
    if (saving || !period || !queue.length) return;

    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      toast("PIN is required.", "error");
      return;
    }

    setSaving(true);
    onProgress({
      message: `Saving ${queue.length} titles`,
      detail: "The batch is written in one request.",
    });

    try {
      await archiveService.writeAction(
        "createMovies",
        { items: queue.map((item) => createBatchPayload(item, period)) },
        pin,
      );
      setQueue([]);
      await refresh();
      toast("Monthly batch saved.");
      navigate("/history");
    } catch (error) {
      toast(`The batch was not saved. ${error.message}`, "error");
    } finally {
      setSaving(false);
      onProgress(null);
    }
  }

  return {
    period,
    queue,
    editingItem,
    saving,
    addMovie,
    changePeriod,
    removeMovie,
    clearQueue,
    openEditor,
    closeEditor,
    updateMovie,
    saveBatch,
  };
}
