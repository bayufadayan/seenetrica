(() => {
  const state = {
    mode: "single",
    movies: [],
    history: [],
    searchResults: [],
    selected: null,
    archivePromise: null,
    recognition: null,
    isListening: false,
    speechBaseText: "",
    speechErrorMessage: "",
    bulk: {
      period: "",
      searchResults: [],
      queue: [],
      editingId: null,
      isSaving: false,
    },
  };

  const searchForm = document.querySelector("#tmdbSearchForm");
  const searchInput = document.querySelector("#tmdbQuery");
  const searchButton = document.querySelector("#tmdbSearchButton");
  const searchStatus = document.querySelector("#tmdbStatus");
  const results = document.querySelector("#tmdbResults");
  const movieForm = document.querySelector("#movieForm");
  const selectionEmpty = document.querySelector("#selectionEmpty");
  const statusField = document.querySelector("#status");
  const watchedFields = document.querySelectorAll(".watched-only");
  const posterInput = document.querySelector("#posterUrl");
  const reviewInput = document.querySelector("#review");
  const speechButton = document.querySelector("#speechButton");
  const speechButtonLabel = document.querySelector("#speechButtonLabel");
  const speechLanguage = document.querySelector("#speechLanguage");
  const speechStatus = document.querySelector("#speechStatus");
  const speechIndicator = document.querySelector("#speechIndicator");
  const saveButton = document.querySelector("#saveMovieButton");

  const modeToggleButton = document.querySelector("#modeToggleButton");
  const modeToggleLabel = document.querySelector("#modeToggleLabel");
  const modeToggleHint = document.querySelector("#modeToggleHint");
  const modeDescription = document.querySelector("#modeDescription");
  const singleAddMode = document.querySelector("#singleAddMode");
  const bulkAddMode = document.querySelector("#bulkAddMode");

  const bulkPeriodInput = document.querySelector("#bulkPeriod");
  const bulkSearchForm = document.querySelector("#bulkSearchForm");
  const bulkSearchInput = document.querySelector("#bulkTmdbQuery");
  const bulkSearchButton = document.querySelector("#bulkSearchButton");
  const bulkSearchStatus = document.querySelector("#bulkSearchStatus");
  const bulkResults = document.querySelector("#bulkTmdbResults");
  const bulkQueue = document.querySelector("#bulkQueue");
  const bulkCount = document.querySelector("#bulkCount");
  const bulkPeriodSummary = document.querySelector("#bulkPeriodSummary");
  const bulkSaveButton = document.querySelector("#bulkSaveButton");
  const bulkClearButton = document.querySelector("#bulkClearButton");

  const batchEditModal = document.querySelector("#batchEditModal");
  const batchEditForm = document.querySelector("#batchEditForm");
  const batchEditMovieTitle = document.querySelector("#batchEditMovieTitle");
  const batchEditMediaType = document.querySelector("#batchEditMediaType");
  const batchEditRuntime = document.querySelector("#batchEditRuntime");
  const batchEditRating = document.querySelector("#batchEditRating");
  const batchEditWatchedAt = document.querySelector("#batchEditWatchedAt");
  const batchEditPosterUrl = document.querySelector("#batchEditPosterUrl");
  const batchEditInTheater = document.querySelector("#batchEditInTheater");
  const batchEditReview = document.querySelector("#batchEditReview");
  const batchEditError = document.querySelector("#batchEditError");
  const batchEditPosterPreview = document.querySelector(
    "#batchEditPosterPreview",
  );
  const batchEditPreviewTitle = document.querySelector(
    "#batchEditPreviewTitle",
  );
  const batchEditPreviewMeta = document.querySelector("#batchEditPreviewMeta");

  const saveOverlay = document.querySelector("#saveOverlay");
  const saveOverlayMessage = document.querySelector("#saveOverlayMessage");
  const saveOverlayDetail = document.querySelector("#saveOverlayDetail");

  const {
    askForPin,
    detailLink,
    escapeHtml,
    fallbackPoster,
    getData,
    link,
    refreshIcons,
    showToast,
    today,
    writeData,
  } = window.Seenetrica;

  function createClientId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function joinTranscript(...parts) {
    return parts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatPeriod(period) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return "the selected month";
    }

    const [year, month] = period.split("-").map(Number);

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  }

  function formatShortDate(value) {
    if (!value) {
      return "Exact day not set";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function setButtonLoading(button, isLoading, loadingLabel) {
    if (!button) {
      return;
    }

    const labelElement = button.querySelector("[data-button-label]");
    const spinner = button.querySelector("[data-button-spinner]");

    if (!button.dataset.defaultLabel && labelElement) {
      button.dataset.defaultLabel = labelElement.textContent.trim();
    }

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
    button.setAttribute("aria-busy", String(isLoading));

    if (spinner) {
      spinner.hidden = !isLoading;
    }

    if (labelElement) {
      labelElement.textContent = isLoading
        ? loadingLabel
        : button.dataset.defaultLabel;
    }
  }

  function setSaveOverlay(
    isVisible,
    message = "Saving your movie…",
    detail = "Please keep this page open.",
  ) {
    saveOverlay.hidden = !isVisible;
    saveOverlay.setAttribute("aria-hidden", String(!isVisible));
    saveOverlayMessage.textContent = message;
    saveOverlayDetail.textContent = detail;
    document.body.classList.toggle("is-saving", isVisible);
  }

  function renderSearchSkeleton(target) {
    target.innerHTML = Array.from(
      { length: 4 },
      (_, index) => `
        <div class="tmdb-result-skeleton" aria-hidden="true">
          <span class="skeleton-block skeleton-poster"></span>

          <span class="skeleton-copy">
            <span class="skeleton-block skeleton-title"></span>
            <span
              class="skeleton-block skeleton-meta skeleton-meta-${index + 1}"
            ></span>
          </span>

          <span class="skeleton-block skeleton-icon"></span>
        </div>
      `,
    ).join("");
  }

  function setResultsBusy(target, isBusy, activeButton = null) {
    target.classList.toggle("is-busy", isBusy);
    target.setAttribute("aria-busy", String(isBusy));

    target.querySelectorAll("[data-result-id]").forEach((button) => {
      button.disabled = isBusy;
      button.classList.toggle(
        "is-loading",
        isBusy && button === activeButton,
      );
    });
  }

  async function fetchTmdbSearch(query) {
    const response = await fetch(
      `/api/tmdb/search?q=${encodeURIComponent(query)}`,
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "TMDB search failed.");
    }

    return payload.results || [];
  }

  async function fetchTmdbDetails(externalId, mediaType) {
    const response = await fetch(
      `/api/tmdb/details?id=${encodeURIComponent(
        externalId,
      )}&type=${encodeURIComponent(mediaType)}`,
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Could not load TMDB details.");
    }

    return payload;
  }

  async function ensureArchiveLoaded(forceRefresh = false) {
    if (forceRefresh) {
      state.archivePromise = null;
    }

    if (!state.archivePromise) {
      state.archivePromise = getData(forceRefresh)
        .then((data) => {
          state.movies = data.movies;
          state.history = data.history;
          return data;
        })
        .catch((error) => {
          state.archivePromise = null;
          throw error;
        });
    }

    return state.archivePromise;
  }

  function archiveContainsTmdbTitle(externalId) {
    return state.movies.some(
      (movie) =>
        movie.external_source === "tmdb" &&
        String(movie.external_id) === String(externalId),
    );
  }

  function setMode(mode) {
    const useBulkMode = mode === "bulk";

    state.mode = useBulkMode ? "bulk" : "single";
    singleAddMode.hidden = useBulkMode;
    bulkAddMode.hidden = !useBulkMode;

    modeToggleButton.setAttribute("aria-pressed", String(useBulkMode));
    modeToggleLabel.textContent = useBulkMode
      ? "Add one title"
      : "Add movies by month";

    modeToggleHint.textContent = useBulkMode
      ? "Return to the regular form for a single detailed entry."
      : "Useful when you want to backfill several titles from the same month.";

    modeDescription.textContent = useBulkMode
      ? "Choose a month, build a list from TMDB, review it, then save everything together."
      : "Search TMDB for the basic details, then make the entry yours.";

    modeToggleButton.querySelector("[data-lucide]")?.setAttribute(
      "data-lucide",
      useBulkMode ? "square-plus" : "layers-3",
    );

    if (useBulkMode) {
      stopSpeechRecognition();
      window.setTimeout(() => bulkPeriodInput.focus(), 50);
    }

    refreshIcons();
  }

  function setWatchedFields() {
    const watched = statusField.value === "watched";

    watchedFields.forEach((field) => {
      field.hidden = !watched;
    });

    document.querySelector("#watchedAt").required = watched;
  }

  function updatePreview() {
    const title = document.querySelector("#title").value.trim() || "Untitled";
    const type = document.querySelector("#mediaType").value;
    const release = document.querySelector("#releaseDate").value;

    document.querySelector("#previewTitle").textContent = title;
    document.querySelector("#previewMeta").textContent = `${type} · ${
      release?.slice(0, 4) || "Release TBA"
    }`;
    document.querySelector("#previewPoster").src =
      posterInput.value || fallbackPoster;
  }

  function stopSpeechRecognition() {
    if (!state.recognition || !state.isListening) {
      return;
    }

    state.recognition.stop();
  }

  function stopSpeechRecognitionAndWait() {
    if (!state.recognition || !state.isListening) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const fallbackTimer = window.setTimeout(resolve, 1500);

      state.recognition.addEventListener(
        "end",
        () => {
          window.clearTimeout(fallbackTimer);
          resolve();
        },
        { once: true },
      );

      try {
        state.recognition.stop();
      } catch (error) {
        window.clearTimeout(fallbackTimer);
        console.error(error);
        resolve();
      }
    });
  }

  function clearSelection() {
    stopSpeechRecognition();
    state.selected = null;
    movieForm.reset();
    movieForm.hidden = true;
    selectionEmpty.hidden = false;

    results.querySelectorAll(".is-selected").forEach((item) => {
      item.classList.remove("is-selected");
    });
  }

  function openForm(movie) {
    stopSpeechRecognition();
    state.selected = movie;
    selectionEmpty.hidden = true;
    movieForm.hidden = false;

    document.querySelector("#title").value = movie.title || "";
    document.querySelector("#mediaType").value = movie.media_type || "movie";
    document.querySelector("#releaseDate").value = movie.release_date || "";
    document.querySelector("#runtime").value = movie.runtime_minutes || "";
    document.querySelector("#posterUrl").value = movie.poster_url || "";
    document.querySelector("#rating").value = "";
    reviewInput.value = "";
    document.querySelector("#watchedAt").value = today();
    document.querySelector("#watchedInTheater").checked = false;
    statusField.value = "watchlist";

    setWatchedFields();
    updatePreview();
    refreshIcons();
  }

  function renderSingleResults() {
    if (!state.searchResults.length) {
      results.innerHTML = `
        <div class="empty-state">
          <p>No matching movies or series found.</p>
        </div>
      `;
      return;
    }

    results.innerHTML = state.searchResults
      .map(
        (item) => `
          <button
            class="tmdb-result"
            type="button"
            data-result-id="${item.external_id}"
            data-result-type="${item.media_type}"
            aria-label="Select ${escapeHtml(item.title)}"
          >
            <img
              src="${escapeHtml(item.poster_url || fallbackPoster)}"
              alt=""
              loading="lazy"
              onerror="this.onerror=null;this.src='${fallbackPoster}'"
            />

            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>
                ${escapeHtml(item.media_type)} ·
                ${item.release_date?.slice(0, 4) || "TBA"}
              </p>
            </div>

            <span class="tmdb-result-action" aria-hidden="true">
              <i class="result-arrow" data-lucide="arrow-right"></i>
              <span class="result-spinner"></span>
            </span>
          </button>
        `,
      )
      .join("");

    refreshIcons();
  }

  async function searchSingleTmdb(query) {
    searchStatus.textContent = "Searching TMDB…";
    renderSearchSkeleton(results);
    state.searchResults = await fetchTmdbSearch(query);
    searchStatus.textContent = `${state.searchResults.length} results found`;
    renderSingleResults();
  }

  async function selectSingleTmdbResult(externalId, mediaType, button) {
    results.querySelectorAll(".is-selected").forEach((item) => {
      item.classList.remove("is-selected");
    });

    button.classList.add("is-selected");
    setResultsBusy(results, true, button);
    searchStatus.textContent = "Loading title details…";

    try {
      const payload = await fetchTmdbDetails(externalId, mediaType);
      searchStatus.textContent = "Title selected. Complete your entry.";
      openForm(payload);
    } finally {
      setResultsBusy(results, false);
    }
  }

  function setSpeechUi(isListening) {
    state.isListening = isListening;
    speechButton.classList.toggle("is-listening", isListening);
    speechButton.setAttribute("aria-pressed", String(isListening));
    speechIndicator.hidden = !isListening;
    speechLanguage.disabled = isListening;
    speechButtonLabel.textContent = isListening
      ? "Stop recording"
      : "Speak review";
    refreshIcons();
  }

  function getSpeechErrorMessage(errorCode) {
    const messages = {
      "audio-capture": "No microphone was detected.",
      "language-not-supported":
        "The selected speech language is not supported.",
      network:
        "Speech recognition could not connect. Try Google Chrome or type the review manually.",
      "no-speech":
        "No speech was detected. Try speaking a little closer to the microphone.",
      "not-allowed":
        "Microphone access was denied. Allow microphone access in the browser.",
      "service-not-allowed": "Speech recognition is blocked by the browser.",
    };

    return messages[errorCode] || "Speech recognition stopped unexpectedly.";
  }

  function initializeSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speechButton.disabled = true;
      speechLanguage.disabled = true;
      speechStatus.textContent =
        "Voice input is not supported by this browser. You can still type your review.";
      return;
    }

    if (!window.isSecureContext) {
      speechButton.disabled = true;
      speechLanguage.disabled = true;
      speechStatus.textContent =
        "Voice input needs HTTPS or localhost before the browser can use the microphone.";
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.addEventListener("start", () => {
      state.speechErrorMessage = "";
      setSpeechUi(true);
      speechStatus.textContent =
        "Listening… Speak naturally. Your words will appear below.";
    });

    recognition.addEventListener("result", (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";

        if (event.results[index].isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interimTranscript += `${transcript} `;
        }
      }

      reviewInput.value = joinTranscript(
        state.speechBaseText,
        finalTranscript,
        interimTranscript,
      );

      reviewInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    recognition.addEventListener("error", (event) => {
      const message = getSpeechErrorMessage(event.error);
      state.speechErrorMessage = message;
      speechStatus.textContent = message;

      if (event.error !== "no-speech") {
        showToast(message, "error");
      }
    });

    recognition.addEventListener("end", () => {
      setSpeechUi(false);

      if (state.speechErrorMessage) {
        speechStatus.textContent = state.speechErrorMessage;
        return;
      }

      speechStatus.textContent = reviewInput.value.trim()
        ? "Transcription added. You can edit the text or record more."
        : "Press the microphone and start speaking.";
    });

    state.recognition = recognition;

    speechButton.addEventListener("click", () => {
      if (state.isListening) {
        recognition.stop();
        return;
      }

      state.speechBaseText = reviewInput.value.trim();
      recognition.lang = speechLanguage.value;

      try {
        recognition.start();
      } catch (error) {
        console.error(error);
        showToast("The microphone is already starting. Try again.", "error");
      }
    });
  }

  function updateBulkPeriodUi() {
    const hasPeriod = /^\d{4}-\d{2}$/.test(state.bulk.period);

    bulkSearchInput.disabled = !hasPeriod || state.bulk.isSaving;
    bulkSearchButton.disabled = !hasPeriod || state.bulk.isSaving;
    bulkSearchInput.placeholder = hasPeriod
      ? "Search a movie or series"
      : "Choose a month first";

    bulkSearchStatus.textContent = hasPeriod
      ? `Add titles watched in ${formatPeriod(state.bulk.period)}.`
      : "Choose a month before searching.";

    bulkPeriodSummary.textContent = hasPeriod
      ? `${formatPeriod(state.bulk.period)} · all items are saved as watched`
      : "Select a month to start building this batch.";

    renderBulkQueue();
  }

  function renderBulkResults() {
    if (!state.bulk.searchResults.length) {
      bulkResults.innerHTML = `
        <div class="empty-state">
          <p>No matching movies or series found.</p>
        </div>
      `;
      return;
    }

    bulkResults.innerHTML = state.bulk.searchResults
      .map((item) => {
        const queued = state.bulk.queue.some(
          (queueItem) =>
            String(queueItem.external_id) === String(item.external_id),
        );
        const archived = archiveContainsTmdbTitle(item.external_id);
        const unavailable = queued || archived;
        const label = archived
          ? "Already saved"
          : queued
            ? "In list"
            : "Add to list";

        return `
          <article class="tmdb-result bulk-tmdb-result ${
            unavailable ? "is-unavailable" : ""
          }">
            <img
              src="${escapeHtml(item.poster_url || fallbackPoster)}"
              alt=""
              loading="lazy"
              onerror="this.onerror=null;this.src='${fallbackPoster}'"
            />

            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>
                ${escapeHtml(item.media_type)} ·
                ${item.release_date?.slice(0, 4) || "TBA"}
              </p>
            </div>

            <button
              class="bulk-add-result-button"
              type="button"
              data-result-id="${item.external_id}"
              data-result-type="${item.media_type}"
              ${unavailable ? "disabled" : ""}
            >
              <span class="result-spinner"></span>
              <i data-lucide="${unavailable ? "check" : "plus"}" aria-hidden="true"></i>
              <span>${label}</span>
            </button>
          </article>
        `;
      })
      .join("");

    refreshIcons();
  }

  async function searchBulkTmdb(query) {
    bulkSearchStatus.textContent = "Searching TMDB…";
    renderSearchSkeleton(bulkResults);
    state.bulk.searchResults = await fetchTmdbSearch(query);
    bulkSearchStatus.textContent = `${state.bulk.searchResults.length} results found`;
    renderBulkResults();
  }

  function createBulkQueueItem(movie) {
    return {
      client_id: createClientId(),
      external_source: movie.external_source || "tmdb",
      external_id: movie.external_id ?? null,
      title: movie.title || "",
      poster_url: movie.poster_url || null,
      release_date: movie.release_date || null,
      media_type: movie.media_type || "movie",
      runtime_minutes: movie.runtime_minutes || null,
      rating: null,
      review: null,
      watched_at: "",
      watched_in_theater: false,
    };
  }

  async function addBulkResult(externalId, mediaType, button) {
    if (!state.bulk.period) {
      showToast("Choose a month first.", "error");
      return;
    }

    if (archiveContainsTmdbTitle(externalId)) {
      showToast("This TMDB title already exists in Seenetrica.", "error");
      renderBulkResults();
      return;
    }

    const queued = state.bulk.queue.some(
      (item) => String(item.external_id) === String(externalId),
    );

    if (queued) {
      showToast("This title is already in the batch.", "error");
      return;
    }

    setResultsBusy(bulkResults, true, button);
    button.classList.add("is-loading");
    bulkSearchStatus.textContent = "Loading title details…";

    try {
      const details = await fetchTmdbDetails(externalId, mediaType);
      state.bulk.queue.push(createBulkQueueItem(details));
      bulkSearchStatus.textContent = `${details.title} added to the list.`;
      renderBulkQueue();
      renderBulkResults();
      showToast(`${details.title} added to the batch.`);
    } finally {
      setResultsBusy(bulkResults, false);
    }
  }

  function renderBulkQueue() {
    const count = state.bulk.queue.length;
    const hasPeriod = /^\d{4}-\d{2}$/.test(state.bulk.period);

    bulkCount.textContent = `${count} ${count === 1 ? "title" : "titles"}`;
    bulkSaveButton.disabled = !hasPeriod || count === 0 || state.bulk.isSaving;
    bulkClearButton.disabled = count === 0 || state.bulk.isSaving;
    bulkPeriodInput.disabled = state.bulk.isSaving;

    const saveLabel = bulkSaveButton.querySelector("[data-button-label]");
    if (!state.bulk.isSaving && saveLabel) {
      const label = count > 0 ? `Save ${count} ${count === 1 ? "title" : "titles"}` : "Save batch";
      bulkSaveButton.dataset.defaultLabel = label;
      saveLabel.textContent = label;
    }

    if (!count) {
      bulkQueue.innerHTML = `
        <div class="bulk-queue-empty" id="bulkQueueEmpty">
          <i data-lucide="list-plus" aria-hidden="true"></i>
          <p>Your selected titles will appear here before anything is saved.</p>
        </div>
      `;
      refreshIcons();
      return;
    }

    bulkQueue.innerHTML = state.bulk.queue
      .map(
        (item, index) => `
          <article class="bulk-queue-item" data-bulk-item-id="${item.client_id}">
            <span class="bulk-queue-number">${String(index + 1).padStart(2, "0")}</span>

            <img
              src="${escapeHtml(item.poster_url || fallbackPoster)}"
              alt=""
              onerror="this.onerror=null;this.src='${fallbackPoster}'"
            />

            <div class="bulk-queue-copy">
              <h3>${escapeHtml(item.title)}</h3>
              <p>
                ${escapeHtml(item.media_type)} ·
                ${item.release_date?.slice(0, 4) || "TBA"}
              </p>

              <div class="bulk-item-facts">
                <span>
                  <i data-lucide="calendar-days" aria-hidden="true"></i>
                  ${escapeHtml(formatShortDate(item.watched_at))}
                </span>
                <span>
                  <i data-lucide="star" aria-hidden="true"></i>
                  ${item.rating === null ? "No rating" : `${item.rating}/10`}
                </span>
              </div>
            </div>

            <div class="bulk-item-actions">
              <button
                class="bulk-icon-button"
                type="button"
                data-edit-bulk-item="${item.client_id}"
                aria-label="Edit ${escapeHtml(item.title)}"
              >
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>

              <button
                class="bulk-icon-button is-danger"
                type="button"
                data-remove-bulk-item="${item.client_id}"
                aria-label="Remove ${escapeHtml(item.title)}"
              >
                <i data-lucide="x" aria-hidden="true"></i>
              </button>
            </div>
          </article>
        `,
      )
      .join("");

    refreshIcons();
  }

  function updateBatchEditPreview() {
    batchEditPosterPreview.src = batchEditPosterUrl.value || fallbackPoster;
    batchEditPreviewTitle.textContent =
      batchEditMovieTitle.value.trim() || "Untitled";
    batchEditPreviewMeta.textContent = `${batchEditMediaType.value} · ${
      batchEditRating.value ? `${batchEditRating.value}/10` : "No rating"
    }`;
  }

  function openBatchEdit(clientId) {
    const item = state.bulk.queue.find(
      (queueItem) => queueItem.client_id === clientId,
    );

    if (!item) {
      return;
    }

    state.bulk.editingId = clientId;
    batchEditMovieTitle.value = item.title;
    batchEditMediaType.value = item.media_type;
    batchEditRuntime.value = item.runtime_minutes || "";
    batchEditRating.value = item.rating ?? "";
    batchEditWatchedAt.value = item.watched_at || "";
    batchEditWatchedAt.min = `${state.bulk.period}-01`;

    const [year, month] = state.bulk.period.split("-").map(Number);
    const finalDay = new Date(year, month, 0).getDate();
    batchEditWatchedAt.max = `${state.bulk.period}-${String(finalDay).padStart(2, "0")}`;

    batchEditPosterUrl.value = item.poster_url || "";
    batchEditInTheater.checked = item.watched_in_theater;
    batchEditReview.value = item.review || "";
    batchEditError.hidden = true;
    batchEditError.textContent = "";

    updateBatchEditPreview();
    batchEditModal.hidden = false;
    document.body.classList.add("is-modal-open");
    window.setTimeout(() => batchEditMovieTitle.focus(), 50);
    refreshIcons();
  }

  function closeBatchEdit() {
    state.bulk.editingId = null;
    batchEditModal.hidden = true;
    document.body.classList.remove("is-modal-open");
  }

  function saveBatchEdit() {
    const item = state.bulk.queue.find(
      (queueItem) => queueItem.client_id === state.bulk.editingId,
    );

    if (!item) {
      closeBatchEdit();
      return;
    }

    const exactDate = batchEditWatchedAt.value;

    if (exactDate && !exactDate.startsWith(`${state.bulk.period}-`)) {
      batchEditError.textContent = `The exact date must be inside ${formatPeriod(
        state.bulk.period,
      )}.`;
      batchEditError.hidden = false;
      return;
    }

    item.title = batchEditMovieTitle.value.trim();
    item.media_type = batchEditMediaType.value;
    item.runtime_minutes = batchEditRuntime.value
      ? Number(batchEditRuntime.value)
      : null;
    item.rating = batchEditRating.value === ""
      ? null
      : Number(batchEditRating.value);
    item.watched_at = exactDate;
    item.poster_url = batchEditPosterUrl.value.trim() || null;
    item.watched_in_theater = batchEditInTheater.checked;
    item.review = batchEditReview.value.trim() || null;

    renderBulkQueue();
    closeBatchEdit();
    showToast(`${item.title} updated.`);
  }

  function clearBulkQueue() {
    if (!state.bulk.queue.length) {
      return;
    }

    const shouldClear = window.confirm(
      "Remove every title from this batch? Nothing has been saved yet.",
    );

    if (!shouldClear) {
      return;
    }

    state.bulk.queue = [];
    renderBulkQueue();
    renderBulkResults();
  }

  function isAuthenticationError(message) {
    return /pin|unauthor|forbidden|permission|access denied/i.test(message);
  }

  async function saveBulkQueue() {
    if (state.bulk.isSaving) {
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(state.bulk.period)) {
      showToast("Choose a valid month and year.", "error");
      bulkPeriodInput.focus();
      return;
    }

    if (!state.bulk.queue.length) {
      showToast("Add at least one title to the list.", "error");
      return;
    }

    try {
      await ensureArchiveLoaded();
    } catch (error) {
      console.error(error);
      showToast("The archive data could not be loaded.", "error");
      return;
    }

    const duplicate = state.bulk.queue.find((item) =>
      archiveContainsTmdbTitle(item.external_id),
    );

    if (duplicate) {
      showToast(
        `${duplicate.title} already exists in Seenetrica. Remove it before saving.`,
        "error",
      );
      return;
    }

    const pin = askForPin();

    if (pin === null) {
      return;
    }

    state.bulk.isSaving = true;
    renderBulkQueue();
    setButtonLoading(bulkSaveButton, true, "Saving batch…");
    setSaveOverlay(
      true,
      "Saving your monthly batch…",
      `Preparing ${state.bulk.queue.length} titles.`,
    );

    const originalQueue = [...state.bulk.queue];
    const savedClientIds = [];
    const failures = [];

    for (let index = 0; index < originalQueue.length; index += 1) {
      const item = originalQueue[index];

      saveOverlayMessage.textContent = `Saving ${index + 1} of ${originalQueue.length}`;
      saveOverlayDetail.textContent = item.title;

      const movie = {
        external_source: item.external_source,
        external_id: item.external_id,
        title: item.title,
        poster_url: item.poster_url,
        release_date: item.release_date,
        media_type: item.media_type,
        runtime_minutes: item.runtime_minutes,
        status: "watched",
        rating: item.rating,
        review: item.review,
      };

      const viewing = {
        watched_at: item.watched_at || `${state.bulk.period}-01`,
        watched_in_theater: item.watched_in_theater,
      };

      try {
        await writeData("createMovie", { movie, viewing }, pin);
        savedClientIds.push(item.client_id);
      } catch (error) {
        console.error(`Could not save ${item.title}:`, error);
        failures.push({ item, message: error.message });

        if (isAuthenticationError(error.message)) {
          break;
        }
      }
    }

    state.bulk.queue = state.bulk.queue.filter(
      (item) => !savedClientIds.includes(item.client_id),
    );
    state.bulk.isSaving = false;
    state.archivePromise = null;

    if (!failures.length && savedClientIds.length === originalQueue.length) {
      setSaveOverlay(
        true,
        "Monthly batch saved.",
        `${savedClientIds.length} titles were added to Seenetrica.`,
      );

      window.setTimeout(() => {
        window.location.href = link("pages/history.html");
      }, 850);
      return;
    }

    setSaveOverlay(false);
    setButtonLoading(bulkSaveButton, false);
    renderBulkQueue();
    renderBulkResults();

    const remainingCount = state.bulk.queue.length;
    const savedCount = savedClientIds.length;
    const firstFailure = failures[0]?.message || "The batch could not be completed.";

    if (savedCount > 0) {
      showToast(
        `${savedCount} saved, ${remainingCount} still in the list. ${firstFailure}`,
        "error",
      );
    } else {
      showToast(firstFailure, "error");
    }
  }

  modeToggleButton.addEventListener("click", () => {
    setMode(state.mode === "single" ? "bulk" : "single");
  });

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();

    if (query.length < 2) {
      searchInput.focus();
      return;
    }

    setButtonLoading(searchButton, true, "Searching…");

    try {
      await searchSingleTmdb(query);
    } catch (error) {
      console.error(error);
      searchStatus.textContent =
        "TMDB is unavailable. Run with “vercel dev” and check TMDB_ACCESS_TOKEN.";
      results.innerHTML = `
        <div class="error-state">
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    } finally {
      setButtonLoading(searchButton, false);
    }
  });

  results.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-result-id]");

    if (!button || button.disabled) {
      return;
    }

    try {
      await selectSingleTmdbResult(
        button.dataset.resultId,
        button.dataset.resultType,
        button,
      );
    } catch (error) {
      console.error(error);
      searchStatus.textContent = error.message;
      showToast(error.message, "error");
    }
  });

  document.querySelector("#manualEntryButton").addEventListener("click", () => {
    openForm({
      external_source: "manual",
      external_id: null,
      title: "",
      poster_url: "",
      release_date: "",
      media_type: "movie",
      runtime_minutes: null,
    });

    document.querySelector("#title").focus();
  });

  document
    .querySelector("#cancelSelection")
    .addEventListener("click", clearSelection);

  statusField.addEventListener("change", setWatchedFields);
  movieForm.addEventListener("input", updatePreview);

  document.querySelector("#previewPoster").addEventListener("error", (event) => {
    event.currentTarget.src = fallbackPoster;
  });

  movieForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await stopSpeechRecognitionAndWait();
    setButtonLoading(saveButton, true, "Checking archive…");

    try {
      await ensureArchiveLoaded();
    } catch (error) {
      console.error(error);
      showToast("The archive data could not be loaded.", "error");
      setButtonLoading(saveButton, false);
      return;
    }

    const externalSource = state.selected?.external_source || "manual";
    const externalId = state.selected?.external_id ?? null;
    const duplicate = state.movies.find(
      (movie) =>
        externalSource === "tmdb" &&
        movie.external_source === "tmdb" &&
        String(movie.external_id) === String(externalId),
    );

    if (duplicate) {
      showToast("This TMDB title already exists in Seenetrica.", "error");
      setButtonLoading(saveButton, false);
      return;
    }

    setButtonLoading(saveButton, false);
    const pin = askForPin();

    if (pin === null) {
      return;
    }

    const ratingValue = document.querySelector("#rating").value;
    const movie = {
      external_source: externalSource,
      external_id: externalId,
      title: document.querySelector("#title").value.trim(),
      poster_url: posterInput.value.trim() || null,
      release_date: document.querySelector("#releaseDate").value || null,
      media_type: document.querySelector("#mediaType").value,
      runtime_minutes: document.querySelector("#runtime").value
        ? Number(document.querySelector("#runtime").value)
        : null,
      status: statusField.value,
      rating: ratingValue === "" ? null : Number(ratingValue),
      review: reviewInput.value.trim() || null,
    };

    const viewing =
      movie.status === "watched"
        ? {
            watched_at: document.querySelector("#watchedAt").value,
            watched_in_theater: document.querySelector("#watchedInTheater")
              .checked,
          }
        : null;

    setButtonLoading(saveButton, true, "Saving movie…");
    setSaveOverlay(true, "Saving your movie to Seenetrica…");

    try {
      const saved = await writeData("createMovie", { movie, viewing }, pin);
      saveOverlayMessage.textContent = "Movie saved. Opening the detail page…";
      showToast("Movie added to Seenetrica.");

      window.setTimeout(() => {
        window.location.href = detailLink(saved.movie.id);
      }, 450);
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
      setSaveOverlay(false);
      setButtonLoading(saveButton, false);
    }
  });

  bulkPeriodInput.addEventListener("change", () => {
    const previousPeriod = state.bulk.period;
    state.bulk.period = bulkPeriodInput.value;

    if (
      previousPeriod &&
      previousPeriod !== state.bulk.period &&
      state.bulk.queue.some((item) => item.watched_at)
    ) {
      state.bulk.queue.forEach((item) => {
        if (item.watched_at && !item.watched_at.startsWith(`${state.bulk.period}-`)) {
          item.watched_at = "";
        }
      });

      showToast(
        "Exact dates outside the new month were cleared. Review the pencil fields if needed.",
      );
    }

    updateBulkPeriodUi();
  });

  bulkSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = bulkSearchInput.value.trim();

    if (!state.bulk.period) {
      showToast("Choose a month first.", "error");
      bulkPeriodInput.focus();
      return;
    }

    if (query.length < 2) {
      bulkSearchInput.focus();
      return;
    }

    setButtonLoading(bulkSearchButton, true, "Searching…");

    try {
      await searchBulkTmdb(query);
    } catch (error) {
      console.error(error);
      bulkSearchStatus.textContent = error.message;
      bulkResults.innerHTML = `
        <div class="error-state">
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    } finally {
      setButtonLoading(bulkSearchButton, false);
      bulkSearchButton.disabled = !state.bulk.period;
    }
  });

  bulkResults.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-result-id]");

    if (!button || button.disabled) {
      return;
    }

    try {
      await addBulkResult(
        button.dataset.resultId,
        button.dataset.resultType,
        button,
      );
    } catch (error) {
      console.error(error);
      bulkSearchStatus.textContent = error.message;
      showToast(error.message, "error");
    }
  });

  bulkQueue.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-bulk-item]");
    const removeButton = event.target.closest("[data-remove-bulk-item]");

    if (editButton) {
      openBatchEdit(editButton.dataset.editBulkItem);
      return;
    }

    if (removeButton) {
      const clientId = removeButton.dataset.removeBulkItem;
      const item = state.bulk.queue.find(
        (queueItem) => queueItem.client_id === clientId,
      );

      state.bulk.queue = state.bulk.queue.filter(
        (queueItem) => queueItem.client_id !== clientId,
      );

      renderBulkQueue();
      renderBulkResults();

      if (item) {
        showToast(`${item.title} removed from the batch.`);
      }
    }
  });

  batchEditForm.addEventListener("input", updateBatchEditPreview);
  batchEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveBatchEdit();
  });

  batchEditPosterPreview.addEventListener("error", (event) => {
    event.currentTarget.src = fallbackPoster;
  });

  document.querySelectorAll("[data-close-batch-edit]").forEach((button) => {
    button.addEventListener("click", closeBatchEdit);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !batchEditModal.hidden) {
      closeBatchEdit();
    }
  });

  bulkClearButton.addEventListener("click", clearBulkQueue);
  bulkSaveButton.addEventListener("click", saveBulkQueue);

  initializeSpeechRecognition();
  setMode("single");
  updateBulkPeriodUi();

  ensureArchiveLoaded().catch((error) => {
    console.error(error);
    showToast("The archive data could not be loaded.", "error");
  });
})();
