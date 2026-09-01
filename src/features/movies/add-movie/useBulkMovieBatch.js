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
    const result = await saveQueueItems(pin);

    removeSavedItems(result.savedIds);
    setSaving(false);
    onProgress(null);
    await refresh().catch(() => {});
    finishBatch(result);
  }

  async function saveQueueItems(pin) {
    const savedIds = [];
    const failures = [];

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      onProgress({
        message: `Saving ${index + 1} of ${queue.length}`,
        detail: item.title,
      });

      try {
        await archiveService.writeAction(
          "createMovie",
          createBatchPayload(item, period),
          pin,
        );
        savedIds.push(item.client_id);
      } catch (error) {
        failures.push(error);
        if (isAuthorizationError(error)) break;
      }
    }

    return { savedIds, failures };
  }

  function removeSavedItems(savedIds) {
    setQueue((currentQueue) =>
      currentQueue.filter((item) => !savedIds.includes(item.client_id)),
    );
  }

  function finishBatch({ savedIds, failures }) {
    if (!failures.length) {
      toast("Monthly batch saved.");
      navigate("/history");
      return;
    }

    const remainingCount = queue.length - savedIds.length;
    toast(
      `${savedIds.length} saved, ${remainingCount} still in the list. ${failures[0].message}`,
      "error",
    );
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

function isAuthorizationError(error) {
  return /pin|unauthor|forbidden/i.test(error.message);
}
