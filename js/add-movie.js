(() => {
  const state = {
    movies: [],
    history: [],
    searchResults: [],
    selected: null,
  };

  const searchForm =
    document.querySelector(
      "#tmdbSearchForm",
    );

  const searchInput =
    document.querySelector(
      "#tmdbQuery",
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

  function setWatchedFields() {
    const watched =
      statusField.value === "watched";

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
        .value.trim() || "Untitled";

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
      `${type} · ${release?.slice(0, 4) || "Release TBA"}`;

    document.querySelector(
      "#previewPoster",
    ).src =
      posterInput.value ||
      fallbackPoster;
  }

  function clearSelection() {
    state.selected = null;

    movieForm.reset();
    movieForm.hidden = true;
    selectionEmpty.hidden = false;

    results
      .querySelectorAll(
        ".is-selected",
      )
      .forEach((item) =>
        item.classList.remove(
          "is-selected",
        ),
      );
  }

  function openForm(movie) {
    state.selected = movie;

    selectionEmpty.hidden = true;
    movieForm.hidden = false;

    document.querySelector(
      "#title",
    ).value = movie.title || "";

    document.querySelector(
      "#mediaType",
    ).value =
      movie.media_type || "movie";

    document.querySelector(
      "#releaseDate",
    ).value =
      movie.release_date || "";

    document.querySelector(
      "#runtime",
    ).value =
      movie.runtime_minutes || "";

    document.querySelector(
      "#posterUrl",
    ).value =
      movie.poster_url || "";

    document.querySelector(
      "#rating",
    ).value = "";

    document.querySelector(
      "#review",
    ).value = "";

    document.querySelector(
      "#watchedAt",
    ).value = today();

    statusField.value = "watchlist";

    setWatchedFields();
    updatePreview();
    refreshIcons();
  }

  function renderResults() {
    if (
      !state.searchResults.length
    ) {
      results.innerHTML =
        '<div class="empty-state"><p>No matching movies or series found.</p></div>';

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

              <i data-lucide="arrow-right" aria-hidden="true"></i>
            </button>
          `,
        )
        .join("");

    refreshIcons();
  }

  async function searchTmdb(query) {
    searchStatus.textContent =
      "Searching TMDB…";

    results.innerHTML = "";

    const response = await fetch(
      `/api/tmdb/search?q=${encodeURIComponent(query)}`,
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
      .forEach((item) =>
        item.classList.remove(
          "is-selected",
        ),
      );

    button.classList.add(
      "is-selected",
    );

    searchStatus.textContent =
      "Loading title details…";

    const response = await fetch(
      `/api/tmdb/details?id=${encodeURIComponent(externalId)}&type=${encodeURIComponent(mediaType)}`,
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
  }

  searchForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const query =
        searchInput.value.trim();

      if (query.length < 2) {
        return;
      }

      try {
        await searchTmdb(query);
      } catch (error) {
        console.error(error);

        searchStatus.textContent =
          "TMDB is unavailable. Run with “vercel dev” and check TMDB_ACCESS_TOKEN.";

        results.innerHTML = `
          <div class="error-state">
            <p>${escapeHtml(error.message)}</p>
          </div>
        `;
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

      if (!button) {
        return;
      }

      try {
        await selectTmdbResult(
          button.dataset.resultId,
          button.dataset.resultType,
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
          media_type: "movie",
          runtime_minutes: null,
        });

        document
          .querySelector("#title")
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

      const externalSource =
        state.selected
          ?.external_source ||
        "manual";

      const externalId =
        state.selected
          ?.external_id ?? null;

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

        return;
      }

      const pin = askForPin();

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
        external_id: externalId,
        title: document
          .querySelector("#title")
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
        status: statusField.value,
        rating:
          ratingValue === ""
            ? null
            : Number(ratingValue),
        review:
          document
            .querySelector("#review")
            .value.trim() || null,
      };

      const viewing =
        movie.status === "watched"
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

      const submitButton =
        movieForm.querySelector(
          'button[type="submit"]',
        );

      submitButton.disabled = true;

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

        showToast(
          "Movie added to Seenetrica.",
        );

        window.setTimeout(() => {
          window.location.href =
            detailLink(
              saved.movie.id,
            );
        }, 450);
      } catch (error) {
        console.error(error);

        showToast(
          error.message,
          "error",
        );

        submitButton.disabled = false;
      }
    },
  );

  getData()
    .then((data) => {
      state.movies = data.movies;
      state.history = data.history;
    })
    .catch((error) => {
      console.error(error);

      showToast(
        "The archive data could not be loaded.",
        "error",
      );
    });
})();