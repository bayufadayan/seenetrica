(() => {
  const state = {
    movies: [],
    history: [],
    searchResults: [],
    selected: null,
    archivePromise: null,
    recognition: null,
    isListening: false,
    speechBaseText: "",
    speechErrorMessage: "",
  };

  const searchForm =
    document.querySelector(
      "#tmdbSearchForm",
    );

  const searchInput =
    document.querySelector(
      "#tmdbQuery",
    );

  const searchButton =
    document.querySelector(
      "#tmdbSearchButton",
    );

  const searchStatus =
    document.querySelector(
      "#tmdbStatus",
    );

  const results =
    document.querySelector(
      "#tmdbResults",
    );

  const movieForm =
    document.querySelector(
      "#movieForm",
    );

  const selectionEmpty =
    document.querySelector(
      "#selectionEmpty",
    );

  const statusField =
    document.querySelector(
      "#status",
    );

  const watchedFields =
    document.querySelectorAll(
      ".watched-only",
    );

  const posterInput =
    document.querySelector(
      "#posterUrl",
    );

  const reviewInput =
    document.querySelector(
      "#review",
    );

  const speechButton =
    document.querySelector(
      "#speechButton",
    );

  const speechButtonLabel =
    document.querySelector(
      "#speechButtonLabel",
    );

  const speechLanguage =
    document.querySelector(
      "#speechLanguage",
    );

  const speechStatus =
    document.querySelector(
      "#speechStatus",
    );

  const speechIndicator =
    document.querySelector(
      "#speechIndicator",
    );

  const saveButton =
    document.querySelector(
      "#saveMovieButton",
    );

  const saveOverlay =
    document.querySelector(
      "#saveOverlay",
    );

  const saveOverlayMessage =
    document.querySelector(
      "#saveOverlayMessage",
    );

  const {
    askForPin,
    detailLink,
    escapeHtml,
    fallbackPoster,
    getData,
    refreshIcons,
    showToast,
    today,
    writeData,
  } = window.Seenetrica;

  function joinTranscript(
    ...parts
  ) {
    return parts
      .map((part) =>
        String(part || "").trim(),
      )
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setButtonLoading(
    button,
    isLoading,
    loadingLabel,
  ) {
    if (!button) {
      return;
    }

    const label =
      button.querySelector(
        "[data-button-label]",
      );

    const spinner =
      button.querySelector(
        "[data-button-spinner]",
      );

    if (
      !button.dataset.defaultLabel &&
      label
    ) {
      button.dataset.defaultLabel =
        label.textContent.trim();
    }

    button.disabled = isLoading;

    button.classList.toggle(
      "is-loading",
      isLoading,
    );

    button.setAttribute(
      "aria-busy",
      String(isLoading),
    );

    if (spinner) {
      spinner.hidden = !isLoading;
    }

    if (label) {
      label.textContent =
        isLoading
          ? loadingLabel
          : button.dataset
            .defaultLabel;
    }
  }

  function setSaveOverlay(
    isVisible,
    message =
      "Saving your movie…",
  ) {
    saveOverlay.hidden =
      !isVisible;

    saveOverlay.setAttribute(
      "aria-hidden",
      String(!isVisible),
    );

    saveOverlayMessage.textContent =
      message;

    document.body.classList.toggle(
      "is-saving",
      isVisible,
    );
  }

  function renderSearchSkeleton() {
    results.innerHTML =
      Array.from(
        { length: 4 },
        (_, index) => `
          <div
            class="tmdb-result-skeleton"
            aria-hidden="true"
          >
            <span
              class="skeleton-block skeleton-poster"
            ></span>

            <span class="skeleton-copy">
              <span
                class="skeleton-block skeleton-title"
              ></span>

              <span
                class="
                  skeleton-block
                  skeleton-meta
                  skeleton-meta-${index + 1}
                "
              ></span>
            </span>

            <span
              class="skeleton-block skeleton-icon"
            ></span>
          </div>
        `,
      ).join("");
  }

  function setResultsBusy(
    isBusy,
    activeButton = null,
  ) {
    results.classList.toggle(
      "is-busy",
      isBusy,
    );

    results.setAttribute(
      "aria-busy",
      String(isBusy),
    );

    results
      .querySelectorAll(
        "[data-result-id]",
      )
      .forEach((button) => {
        button.disabled = isBusy;

        button.classList.toggle(
          "is-loading",
          isBusy &&
          button === activeButton,
        );
      });
  }

  function setWatchedFields() {
    const watched =
      statusField.value ===
      "watched";

    watchedFields.forEach(
      (field) => {
        field.hidden = !watched;
      },
    );

    document.querySelector(
      "#watchedAt",
    ).required = watched;
  }

  function updatePreview() {
    const title =
      document
        .querySelector("#title")
        .value.trim() ||
      "Untitled";

    const type =
      document.querySelector(
        "#mediaType",
      ).value;

    const release =
      document.querySelector(
        "#releaseDate",
      ).value;

    document.querySelector(
      "#previewTitle",
    ).textContent = title;

    document.querySelector(
      "#previewMeta",
    ).textContent =
      `${type} · ${release?.slice(0, 4) ||
      "Release TBA"
      }`;

    document.querySelector(
      "#previewPoster",
    ).src =
      posterInput.value ||
      fallbackPoster;
  }

  function stopSpeechRecognition() {
    if (
      !state.recognition ||
      !state.isListening
    ) {
      return;
    }

    state.recognition.stop();
  }

  function stopSpeechRecognitionAndWait() {
    if (
      !state.recognition ||
      !state.isListening
    ) {
      return Promise.resolve();
    }

    return new Promise(
      (resolve) => {
        const fallbackTimer =
          window.setTimeout(
            resolve,
            1500,
          );

        state.recognition.addEventListener(
          "end",
          () => {
            window.clearTimeout(
              fallbackTimer,
            );

            resolve();
          },
          {
            once: true,
          },
        );

        try {
          state.recognition.stop();
        } catch (error) {
          window.clearTimeout(
            fallbackTimer,
          );

          console.error(error);
          resolve();
        }
      },
    );
  }

  function clearSelection() {
    stopSpeechRecognition();

    state.selected = null;

    movieForm.reset();
    movieForm.hidden = true;
    selectionEmpty.hidden = false;

    results
      .querySelectorAll(
        ".is-selected",
      )
      .forEach((item) => {
        item.classList.remove(
          "is-selected",
        );
      });
  }

  function openForm(movie) {
    stopSpeechRecognition();

    state.selected = movie;

    selectionEmpty.hidden = true;
    movieForm.hidden = false;

    document.querySelector(
      "#title",
    ).value =
      movie.title || "";

    document.querySelector(
      "#mediaType",
    ).value =
      movie.media_type ||
      "movie";

    document.querySelector(
      "#releaseDate",
    ).value =
      movie.release_date || "";

    document.querySelector(
      "#runtime",
    ).value =
      movie.runtime_minutes ||
      "";

    document.querySelector(
      "#posterUrl",
    ).value =
      movie.poster_url || "";

    document.querySelector(
      "#rating",
    ).value = "";

    reviewInput.value = "";

    document.querySelector(
      "#watchedAt",
    ).value = today();

    document.querySelector(
      "#watchedInTheater",
    ).checked = false;

    statusField.value =
      "watchlist";

    setWatchedFields();
    updatePreview();
    refreshIcons();
  }

  function renderResults() {
    if (
      !state.searchResults.length
    ) {
      results.innerHTML = `
        <div class="empty-state">
          <p>
            No matching movies or
            series found.
          </p>
        </div>
      `;

      return;
    }

    results.innerHTML =
      state.searchResults
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
                src="${escapeHtml(
            item.poster_url ||
            fallbackPoster,
          )}"
                alt=""
                loading="lazy"
                onerror="
                  this.onerror=null;
                  this.src='${fallbackPoster}'
                "
              />

              <div>
                <h3>
                  ${escapeHtml(
            item.title,
          )}
                </h3>

                <p>
                  ${escapeHtml(
            item.media_type,
          )}
                  ·
                  ${item.release_date
              ?.slice(0, 4) ||
            "TBA"
            }
                </p>
              </div>

              <span
                class="tmdb-result-action"
                aria-hidden="true"
              >
                <i
                  class="result-arrow"
                  data-lucide="arrow-right"
                ></i>

                <span
                  class="result-spinner"
                ></span>
              </span>
            </button>
          `,
        )
        .join("");

    refreshIcons();
  }

  async function searchTmdb(
    query,
  ) {
    searchStatus.textContent =
      "Searching TMDB…";

    renderSearchSkeleton();

    const response = await fetch(
      `/api/tmdb/search?q=${encodeURIComponent(
        query,
      )}`,
    );

    const payload =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload.error ||
        "TMDB search failed.",
      );
    }

    state.searchResults =
      payload.results || [];

    searchStatus.textContent =
      `${state.searchResults.length} results found`;

    renderResults();
  }

  async function selectTmdbResult(
    externalId,
    mediaType,
    button,
  ) {
    results
      .querySelectorAll(
        ".is-selected",
      )
      .forEach((item) => {
        item.classList.remove(
          "is-selected",
        );
      });

    button.classList.add(
      "is-selected",
    );

    setResultsBusy(
      true,
      button,
    );

    searchStatus.textContent =
      "Loading title details…";

    try {
      const response =
        await fetch(
          `/api/tmdb/details?id=${encodeURIComponent(
            externalId,
          )}&type=${encodeURIComponent(
            mediaType,
          )}`,
        );

      const payload =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
          "Could not load TMDB details.",
        );
      }

      searchStatus.textContent =
        "Title selected. Complete your entry.";

      openForm(payload);
    } finally {
      setResultsBusy(false);
    }
  }

  function setSpeechUi(
    isListening,
  ) {
    state.isListening =
      isListening;

    speechButton.classList.toggle(
      "is-listening",
      isListening,
    );

    speechButton.setAttribute(
      "aria-pressed",
      String(isListening),
    );

    speechIndicator.hidden =
      !isListening;

    speechLanguage.disabled =
      isListening;

    speechButtonLabel.textContent =
      isListening
        ? "Stop recording"
        : "Speak review";

    refreshIcons();
  }

  function getSpeechErrorMessage(
    errorCode,
  ) {
    const messages = {
      "audio-capture":
        "No microphone was detected.",

      "language-not-supported":
        "The selected speech language is not supported.",

      network:
        "Speech recognition could not connect to the recognition service.",

      "no-speech":
        "No speech was detected. Try speaking a little closer to the microphone.",

      "not-allowed":
        "Microphone access was denied. Allow microphone access in the browser.",

      "service-not-allowed":
        "Speech recognition is blocked by the browser.",
    };

    return (
      messages[errorCode] ||
      "Speech recognition stopped unexpectedly."
    );
  }

  function initializeSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speechButton.disabled =
        true;

      speechLanguage.disabled =
        true;

      speechStatus.textContent =
        "Voice input is not supported by this browser. You can still type your review.";

      return;
    }

    if (!window.isSecureContext) {
      speechButton.disabled =
        true;

      speechLanguage.disabled =
        true;

      speechStatus.textContent =
        "Voice input needs HTTPS or localhost before the browser can use the microphone.";

      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.continuous =
      true;

    recognition.interimResults =
      true;

    recognition.maxAlternatives =
      1;

    recognition.addEventListener(
      "start",
      () => {
        state.speechErrorMessage =
          "";

        setSpeechUi(true);

        speechStatus.textContent =
          "Listening… Speak naturally. Your words will appear below.";
      },
    );

    recognition.addEventListener(
      "result",
      (event) => {
        let finalTranscript =
          "";

        let interimTranscript =
          "";

        for (
          let index = 0;
          index <
          event.results.length;
          index += 1
        ) {
          const transcript =
            event.results[index][0]
              ?.transcript || "";

          if (
            event.results[index]
              .isFinal
          ) {
            finalTranscript +=
              `${transcript} `;
          } else {
            interimTranscript +=
              `${transcript} `;
          }
        }

        reviewInput.value =
          joinTranscript(
            state.speechBaseText,
            finalTranscript,
            interimTranscript,
          );

        reviewInput.dispatchEvent(
          new Event("input", {
            bubbles: true,
          }),
        );
      },
    );

    recognition.addEventListener(
      "error",
      (event) => {
        const message =
          getSpeechErrorMessage(
            event.error,
          );

        state.speechErrorMessage =
          message;

        speechStatus.textContent =
          message;

        if (
          event.error !==
          "no-speech"
        ) {
          showToast(
            message,
            "error",
          );
        }
      },
    );

    recognition.addEventListener(
      "end",
      () => {
        setSpeechUi(false);

        if (
          state.speechErrorMessage
        ) {
          speechStatus.textContent =
            state.speechErrorMessage;

          return;
        }

        speechStatus.textContent =
          reviewInput.value.trim()
            ? "Transcription added. You can edit the text or record more."
            : "Press the microphone and start speaking.";
      },
    );

    state.recognition =
      recognition;

    speechButton.addEventListener(
      "click",
      () => {
        if (
          state.isListening
        ) {
          recognition.stop();
          return;
        }

        state.speechBaseText =
          reviewInput.value.trim();

        recognition.lang =
          speechLanguage.value;

        try {
          recognition.start();
        } catch (error) {
          console.error(error);

          showToast(
            "The microphone is already starting. Try again.",
            "error",
          );
        }
      },
    );
  }

  async function ensureArchiveLoaded() {
    if (
      !state.archivePromise
    ) {
      state.archivePromise =
        getData()
          .then((data) => {
            state.movies =
              data.movies;

            state.history =
              data.history;

            return data;
          })
          .catch((error) => {
            state.archivePromise =
              null;

            throw error;
          });
    }

    return state.archivePromise;
  }

  searchForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const query =
        searchInput.value.trim();

      if (query.length < 2) {
        searchInput.focus();
        return;
      }

      setButtonLoading(
        searchButton,
        true,
        "Searching…",
      );

      try {
        await searchTmdb(query);
      } catch (error) {
        console.error(error);

        searchStatus.textContent =
          "TMDB is unavailable. Run with “vercel dev” and check TMDB_ACCESS_TOKEN.";

        results.innerHTML = `
          <div class="error-state">
            <p>
              ${escapeHtml(
          error.message,
        )}
            </p>
          </div>
        `;
      } finally {
        setButtonLoading(
          searchButton,
          false,
        );
      }
    },
  );

  results.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          "[data-result-id]",
        );

      if (
        !button ||
        button.disabled
      ) {
        return;
      }

      try {
        await selectTmdbResult(
          button.dataset.resultId,
          button.dataset
            .resultType,
          button,
        );
      } catch (error) {
        console.error(error);

        searchStatus.textContent =
          error.message;

        showToast(
          error.message,
          "error",
        );
      }
    },
  );

  document
    .querySelector(
      "#manualEntryButton",
    )
    .addEventListener(
      "click",
      () => {
        openForm({
          external_source:
            "manual",

          external_id: null,

          title: "",

          poster_url: "",

          release_date: "",

          media_type:
            "movie",

          runtime_minutes:
            null,
        });

        document
          .querySelector(
            "#title",
          )
          .focus();
      },
    );

  document
    .querySelector(
      "#cancelSelection",
    )
    .addEventListener(
      "click",
      clearSelection,
    );

  statusField.addEventListener(
    "change",
    setWatchedFields,
  );

  movieForm.addEventListener(
    "input",
    updatePreview,
  );

  document
    .querySelector(
      "#previewPoster",
    )
    .addEventListener(
      "error",
      (event) => {
        event.currentTarget.src =
          fallbackPoster;
      },
    );

  movieForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      await stopSpeechRecognitionAndWait();

      setButtonLoading(
        saveButton,
        true,
        "Checking archive…",
      );

      try {
        await ensureArchiveLoaded();
      } catch (error) {
        console.error(error);

        showToast(
          "The archive data could not be loaded.",
          "error",
        );

        setButtonLoading(
          saveButton,
          false,
        );

        return;
      }

      const externalSource =
        state.selected
          ?.external_source ||
        "manual";

      const externalId =
        state.selected
          ?.external_id ??
        null;

      const duplicate =
        state.movies.find(
          (movie) =>
            externalSource ===
            "tmdb" &&
            movie.external_source ===
            "tmdb" &&
            String(
              movie.external_id,
            ) ===
            String(externalId),
        );

      if (duplicate) {
        showToast(
          "This TMDB title already exists in Seenetrica.",
          "error",
        );

        setButtonLoading(
          saveButton,
          false,
        );

        return;
      }

      setButtonLoading(
        saveButton,
        false,
      );

      const pin =
        askForPin();

      if (pin === null) {
        return;
      }

      const ratingValue =
        document.querySelector(
          "#rating",
        ).value;

      const movie = {
        external_source:
          externalSource,

        external_id:
          externalId,

        title: document
          .querySelector(
            "#title",
          )
          .value.trim(),

        poster_url:
          posterInput.value.trim() ||
          null,

        release_date:
          document.querySelector(
            "#releaseDate",
          ).value || null,

        media_type:
          document.querySelector(
            "#mediaType",
          ).value,

        runtime_minutes:
          document.querySelector(
            "#runtime",
          ).value
            ? Number(
              document.querySelector(
                "#runtime",
              ).value,
            )
            : null,

        status:
          statusField.value,

        rating:
          ratingValue === ""
            ? null
            : Number(
              ratingValue,
            ),

        review:
          reviewInput.value.trim() ||
          null,
      };

      const viewing =
        movie.status ===
          "watched"
          ? {
            watched_at:
              document.querySelector(
                "#watchedAt",
              ).value,

            watched_in_theater:
              document.querySelector(
                "#watchedInTheater",
              ).checked,
          }
          : null;

      setButtonLoading(
        saveButton,
        true,
        "Saving movie…",
      );

      setSaveOverlay(
        true,
        "Saving your movie to Seenetrica…",
      );

      try {
        const saved =
          await writeData(
            "createMovie",
            {
              movie,
              viewing,
            },
            pin,
          );

        saveOverlayMessage.textContent =
          "Movie saved. Opening the detail page…";

        showToast(
          "Movie added to Seenetrica.",
        );

        window.setTimeout(
          () => {
            window.location.href =
              detailLink(
                saved.movie.id,
              );
          },
          450,
        );
      } catch (error) {
        console.error(error);

        showToast(
          error.message,
          "error",
        );

        setSaveOverlay(false);

        setButtonLoading(
          saveButton,
          false,
        );
      }
    },
  );

  initializeSpeechRecognition();

  ensureArchiveLoaded().catch(
    (error) => {
      console.error(error);

      showToast(
        "The archive data could not be loaded.",
        "error",
      );
    },
  );
})();