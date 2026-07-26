(() => {
  const container = document.querySelector("#movieDetail");
  const statusElement = document.querySelector("#detailStatus");

  const movieId = new URLSearchParams(window.location.search).get("id");

  const memoryUploadModal = document.querySelector("#memoryUploadModal");
  const detailMemoryForm = document.querySelector("#detailMemoryForm");
  const detailMemoryFiles = document.querySelector("#detailMemoryFiles");
  const detailMemoryDrafts = document.querySelector("#detailMemoryDrafts");
  const detailMemoryStatus = document.querySelector("#detailMemoryStatus");
  const uploadMemoriesButton = document.querySelector("#uploadMemoriesButton");

  const memoryLightbox = document.querySelector("#memoryLightbox");
  const memoryLightboxImage = document.querySelector("#memoryLightboxImage");
  const memoryLightboxTitle = document.querySelector("#memoryLightboxTitle");
  const memoryLightboxMeta = document.querySelector("#memoryLightboxMeta");
  const memoryEditForm = document.querySelector("#memoryEditForm");
  const memoryEditType = document.querySelector("#memoryEditType");
  const memoryEditDate = document.querySelector("#memoryEditDate");
  const memoryEditCaption = document.querySelector("#memoryEditCaption");
  const saveMemoryButton = document.querySelector("#saveMemoryButton");
  const deleteMemoryButton = document.querySelector("#deleteMemoryButton");

  const state = {
    movies: [],
    history: [],
    memories: [],
    movie: null,
    activeMemoryId: null,
  };

  const {
    askForPin,
    authenticatedPost,
    escapeHtml,
    fallbackPoster,
    formatDate,
    formatRating,
    formatRuntime,
    getData,
    refreshIcons,
    showToast,
    today,
    writeData,
  } = window.Seenetrica;

  const {
    MemoryComposer,
    cloudinaryImageUrl,
    formatBytes,
  } = window.SeenetricaMemories;

  const memoryComposer = new MemoryComposer({
    input: detailMemoryFiles,
    list: detailMemoryDrafts,
    status: detailMemoryStatus,
    maxFiles: 5,
  });

  function setButtonLoading(button, isLoading, loadingLabel = "Saving…") {
    if (!button) {
      return;
    }

    const label = button.querySelector("[data-button-label]");
    const spinner = button.querySelector("[data-button-spinner]");

    if (label && !button.dataset.defaultLabel) {
      button.dataset.defaultLabel = label.textContent.trim();
    }

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
    button.setAttribute("aria-busy", String(isLoading));

    if (spinner) {
      spinner.hidden = !isLoading;
    }

    if (label) {
      label.textContent = isLoading
        ? loadingLabel
        : button.dataset.defaultLabel;
    }
  }

  function movieHistory() {
    return state.history
      .filter((entry) => entry.movie_id === state.movie.id)
      .sort((first, second) =>
        String(second.watched_at || "").localeCompare(
          String(first.watched_at || ""),
        ),
      );
  }

  function movieMemories() {
    return state.memories
      .filter((memory) => memory.movie_id === state.movie.id)
      .sort((first, second) => {
        const orderDifference =
          Number(first.sort_order || 0) - Number(second.sort_order || 0);

        if (orderDifference !== 0) {
          return orderDifference;
        }

        return String(first.created_at || "").localeCompare(
          String(second.created_at || ""),
        );
      });
  }

  function activeMemory() {
    return state.memories.find(
      (memory) => memory.id === state.activeMemoryId,
    );
  }

  function renderViewings() {
    const entries = movieHistory();

    if (!entries.length) {
      return '<p class="collection-status">No viewing entries yet.</p>';
    }

    return `
      <div class="viewing-list">
        ${entries
          .map(
            (entry) => `
              <div class="viewing-item">
                <div>
                  <p>${formatDate(entry.watched_at, {
                    fallback: "Date unknown",
                  })}</p>
                  <span>
                    ${entry.watched_in_theater
                      ? "Watched in a theater"
                      : "Watched elsewhere"}
                  </span>
                </div>

                <i
                  data-lucide="${
                    entry.watched_in_theater
                      ? "clapperboard"
                      : "monitor-play"
                  }"
                  aria-hidden="true"
                ></i>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderMemories() {
    const memories = movieMemories();
    const countLabel = `${memories.length} ${
      memories.length === 1 ? "memory" : "memories"
    }`;

    const gallery = memories.length
      ? memories
          .map((memory) => {
            const thumbnail = cloudinaryImageUrl(memory.image_url, {
              width: 720,
              height: 720,
              crop: "fill",
              gravity: "auto",
              quality: "q_auto:good",
            });

            const caption = memory.caption || "A memory from this title";
            const date = formatDate(memory.memory_date, {
              fallback: "Date not set",
            });

            return `
              <article class="memory-card">
                <button
                  class="memory-card-button"
                  type="button"
                  data-memory-id="${escapeHtml(memory.id)}"
                  aria-label="Open memory: ${escapeHtml(caption)}"
                >
                  <div class="memory-card-image">
                    <img
                      src="${escapeHtml(thumbnail)}"
                      alt="${escapeHtml(caption)}"
                      loading="lazy"
                    />

                    <span class="memory-type-badge">
                      ${escapeHtml(memory.memory_type || "photo")}
                    </span>
                  </div>

                  <div class="memory-card-copy">
                    <strong>${escapeHtml(caption)}</strong>
                    <span>${escapeHtml(date)}</span>
                  </div>
                </button>
              </article>
            `;
          })
          .join("")
      : `
        <div class="memory-gallery-empty">
          <p>No personal memories have been attached to this title yet.</p>
        </div>
      `;

    return `
      <section class="memories-block">
        <div class="memories-heading">
          <div>
            <p class="section-kicker">Personal gallery</p>
            <h2>Memories</h2>
            <p class="memory-count">${countLabel}</p>
          </div>

          <button
            class="secondary-button"
            type="button"
            data-open-memory-upload
          >
            <i data-lucide="image-plus" aria-hidden="true"></i>
            Add memories
          </button>
        </div>

        <div class="memory-gallery">
          ${gallery}
        </div>
      </section>
    `;
  }

  function render() {
    const movie = state.movie;

    document.title = `${movie.title} — Seenetrica`;
    statusElement.hidden = true;
    container.hidden = false;

    container.innerHTML = `
      <div class="detail-poster">
        <img
          src="${escapeHtml(movie.poster_url || fallbackPoster)}"
          alt="${escapeHtml(movie.title)} poster"
          onerror="this.onerror=null;this.src='${fallbackPoster}'"
        />
      </div>

      <div class="detail-content">
        <p class="eyebrow">
          ${escapeHtml(movie.status)} · ${escapeHtml(movie.media_type)}
        </p>

        <h1>${escapeHtml(movie.title)}</h1>

        <div class="detail-facts">
          <span class="detail-fact">
            ${movie.release_date?.slice(0, 4) || "Release TBA"}
          </span>

          <span class="detail-fact">
            ${formatRuntime(movie.runtime_minutes)}
          </span>

          <span class="detail-fact">
            ★ ${formatRating(movie.rating)} / 10
          </span>

          ${
            movie.external_source === "tmdb"
              ? '<span class="detail-fact">TMDB entry</span>'
              : '<span class="detail-fact">Manual entry</span>'
          }
        </div>

        <section class="review-block">
          <p class="section-kicker">Review & impression</p>
          <h2>What stayed</h2>

          <p class="review-copy">
            ${
              movie.review
                ? `“${escapeHtml(movie.review)}”`
                : "No impression has been written yet."
            }
          </p>
        </section>

        ${renderMemories()}

        <section class="viewing-block">
          <p class="section-kicker">Screenings</p>
          <h2>Viewing history</h2>

          ${renderViewings()}

          <form id="viewingForm" class="form-grid" style="margin-top: 24px">
            <label class="form-field">
              <span>Watched on</span>
              <input
                id="newWatchedAt"
                type="date"
                value="${today()}"
                required
              />
            </label>

            <label class="checkbox-field">
              <input id="newWatchedInTheater" type="checkbox" />
              Watched in a theater
            </label>

            <div class="form-actions is-full">
              <button class="secondary-button" type="submit">
                <i data-lucide="plus" aria-hidden="true"></i>
                Add viewing
              </button>
            </div>
          </form>
        </section>

        <section class="edit-block">
          <p class="section-kicker">Personal notes</p>
          <h2>Edit this entry</h2>

          <form id="editMovieForm" class="form-grid">
            <label class="form-field is-full">
              <span>Title</span>
              <input id="editTitle" value="${escapeHtml(movie.title)}" required />
            </label>

            <label class="form-field">
              <span>Status</span>
              <select id="editStatus">
                <option value="plan" ${movie.status === "plan" ? "selected" : ""}>
                  Planned
                </option>
                <option value="watchlist" ${
                  movie.status === "watchlist" ? "selected" : ""
                }>
                  Watchlist
                </option>
                <option value="watched" ${
                  movie.status === "watched" ? "selected" : ""
                }>
                  Watched
                </option>
              </select>
            </label>

            <label class="form-field">
              <span>Rating (0–10)</span>
              <input
                id="editRating"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value="${movie.rating ?? ""}"
              />
            </label>

            <label class="form-field is-full">
              <span>Review or impression</span>
              <textarea id="editReview">${escapeHtml(movie.review || "")}</textarea>
            </label>

            <div class="form-actions is-full">
              <button class="primary-button" type="submit">
                <i data-lucide="save" aria-hidden="true"></i>
                Save changes
              </button>
            </div>
          </form>
        </section>
      </div>
    `;

    bindDynamicForms();
    refreshIcons();
  }

  async function reloadMovie() {
    const data = await getData(true);

    state.movies = data.movies;
    state.history = data.history;
    state.memories = data.memories || [];
    state.movie = state.movies.find((movie) => movie.id === movieId);

    if (!state.movie) {
      throw new Error("Movie was not found.");
    }

    render();
  }

  function openMemoryUpload() {
    memoryUploadModal.hidden = false;
    document.body.classList.add("is-memory-modal-open");
    window.setTimeout(() => detailMemoryFiles.focus(), 40);
  }

  function closeMemoryUpload(force = false) {
    if (!force && uploadMemoriesButton.disabled) {
      return;
    }

    memoryUploadModal.hidden = true;
    document.body.classList.remove("is-memory-modal-open");
  }

  function openMemoryLightbox(memoryIdToOpen) {
    const memory = state.memories.find((item) => item.id === memoryIdToOpen);

    if (!memory) {
      showToast("Memory was not found.", "error");
      return;
    }

    state.activeMemoryId = memory.id;
    const caption = memory.caption || `A memory from ${state.movie.title}`;
    const imageUrl = cloudinaryImageUrl(memory.image_url, {
      width: 2560,
      quality: "q_auto:best",
    });

    memoryLightboxImage.src = imageUrl;
    memoryLightboxImage.alt = caption;
    memoryLightboxTitle.textContent = caption;
    memoryLightboxMeta.textContent = [
      memory.memory_type || "photo",
      formatDate(memory.memory_date, { fallback: "date not set" }),
      memory.width && memory.height ? `${memory.width} × ${memory.height}` : null,
      memory.bytes ? formatBytes(memory.bytes) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    memoryEditType.value = memory.memory_type || "photo";
    memoryEditDate.value = memory.memory_date || "";
    memoryEditCaption.value = memory.caption || "";

    memoryLightbox.hidden = false;
    document.body.classList.add("is-memory-modal-open");
    refreshIcons();
  }

  function closeMemoryLightbox(force = false) {
    if (!force && (saveMemoryButton.disabled || deleteMemoryButton.disabled)) {
      return;
    }

    state.activeMemoryId = null;
    memoryLightbox.hidden = true;
    memoryLightboxImage.src = "";
    document.body.classList.remove("is-memory-modal-open");
  }

  function bindDynamicForms() {
    document
      .querySelector("#viewingForm")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const pin = askForPin();

        if (pin === null) {
          return;
        }

        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
          await writeData(
            "addViewing",
            {
              movie_id: state.movie.id,
              watched_at: document.querySelector("#newWatchedAt").value,
              watched_in_theater: document.querySelector("#newWatchedInTheater").checked,
            },
            pin,
          );

          await reloadMovie();
          showToast("Viewing added to history.");
        } catch (error) {
          console.error(error);
          showToast(error.message, "error");
          button.disabled = false;
        }
      });

    document
      .querySelector("#editMovieForm")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const pin = askForPin();

        if (pin === null) {
          return;
        }

        const button = event.currentTarget.querySelector('button[type="submit"]');
        const ratingValue = document.querySelector("#editRating").value;
        button.disabled = true;

        try {
          await writeData(
            "updateMovie",
            {
              id: state.movie.id,
              title: document.querySelector("#editTitle").value.trim(),
              status: document.querySelector("#editStatus").value,
              rating: ratingValue === "" ? null : Number(ratingValue),
              review: document.querySelector("#editReview").value.trim() || null,
            },
            pin,
          );

          await reloadMovie();
          showToast("Movie entry updated.");
        } catch (error) {
          console.error(error);
          showToast(error.message, "error");
          button.disabled = false;
        }
      });

    document
      .querySelector("[data-open-memory-upload]")
      .addEventListener("click", openMemoryUpload);

    container.querySelectorAll("[data-memory-id]").forEach((button) => {
      button.addEventListener("click", () => {
        openMemoryLightbox(button.dataset.memoryId);
      });
    });
  }

  detailMemoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!memoryComposer.hasItems()) {
      showToast("Choose at least one memory image.", "error");
      detailMemoryFiles.focus();
      return;
    }

    const pin = askForPin();

    if (pin === null) {
      return;
    }

    setButtonLoading(uploadMemoriesButton, true, "Uploading memories…");

    try {
      const result = await memoryComposer.uploadAll(state.movie.id, pin, {
        sortOffset: movieMemories().length,
        onProgress: ({ index, total, draft, stage }) => {
          detailMemoryStatus.textContent =
            stage === "error"
              ? `${draft.file.name} could not be saved.`
              : `Processing ${index + 1} of ${total}: ${draft.file.name}`;
        },
      });

      memoryComposer.removeDrafts(result.successfulIds);

      if (result.saved.length) {
        await reloadMovie();
      }

      if (!result.failures.length) {
        memoryComposer.clear();
        closeMemoryUpload(true);
        showToast(
          `${result.saved.length} ${result.saved.length === 1 ? "memory" : "memories"} added.`,
        );
      } else {
        showToast(
          `${result.saved.length} saved, ${result.failures.length} need to be retried.`,
          "error",
        );
      }
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      setButtonLoading(uploadMemoriesButton, false);
    }
  });

  memoryEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const memory = activeMemory();

    if (!memory) {
      return;
    }

    const pin = askForPin();

    if (pin === null) {
      return;
    }

    saveMemoryButton.disabled = true;

    try {
      await writeData(
        "updateMemory",
        {
          id: memory.id,
          caption: memoryEditCaption.value.trim() || null,
          memory_type: memoryEditType.value,
          memory_date: memoryEditDate.value || null,
          sort_order: memory.sort_order || 0,
        },
        pin,
      );

      const memoryIdToReopen = memory.id;
      await reloadMovie();
      openMemoryLightbox(memoryIdToReopen);
      showToast("Memory details updated.");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      saveMemoryButton.disabled = false;
    }
  });

  deleteMemoryButton.addEventListener("click", async () => {
    const memory = activeMemory();

    if (!memory) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this memory from Seenetrica and Cloudinary? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    const pin = askForPin();

    if (pin === null) {
      return;
    }

    deleteMemoryButton.disabled = true;
    saveMemoryButton.disabled = true;

    try {
      await authenticatedPost(
        "/api/memories/delete",
        {
          memory_id: memory.id,
        },
        pin,
      );

      closeMemoryLightbox(true);
      await reloadMovie();
      showToast("Memory deleted.");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      deleteMemoryButton.disabled = false;
      saveMemoryButton.disabled = false;
    }
  });

  document.querySelectorAll("[data-close-memory-upload]").forEach((button) => {
    button.addEventListener("click", closeMemoryUpload);
  });

  document.querySelectorAll("[data-close-memory-lightbox]").forEach((button) => {
    button.addEventListener("click", closeMemoryLightbox);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!memoryLightbox.hidden) {
      closeMemoryLightbox();
    } else if (!memoryUploadModal.hidden) {
      closeMemoryUpload();
    }
  });

  function showUploadResultFromQuery() {
    const parameters = new URLSearchParams(window.location.search);
    const saved = Number(parameters.get("memory_saved") || 0);
    const failed = Number(parameters.get("memory_failed") || 0);

    if (!saved && !failed) {
      return;
    }

    if (failed) {
      showToast(
        `${saved} memories saved. ${failed} need to be retried from this page.`,
        "error",
      );
    } else {
      showToast(`${saved} ${saved === 1 ? "memory" : "memories"} saved.`);
    }

    parameters.delete("memory_saved");
    parameters.delete("memory_failed");

    const nextUrl = `${window.location.pathname}?${parameters.toString()}`.replace(/\?$/, "");
    window.history.replaceState({}, "", nextUrl);
  }

  if (!movieId) {
    statusElement.classList.add("error-state");
    statusElement.innerHTML = `
      <p>
        No movie was selected.<br />
        <a class="section-link" href="../index.html">Return home</a>
      </p>
    `;
    return;
  }

  getData()
    .then((data) => {
      state.movies = data.movies;
      state.history = data.history;
      state.memories = data.memories || [];
      state.movie = state.movies.find((movie) => movie.id === movieId);

      if (!state.movie) {
        throw new Error("Movie not found.");
      }

      render();
      showUploadResultFromQuery();
    })
    .catch((error) => {
      console.error(error);
      statusElement.classList.add("error-state");
      statusElement.innerHTML = `
        <p>
          This movie could not be found.<br />
          <a class="section-link" href="../index.html">Return home</a>
        </p>
      `;
    });
})();
