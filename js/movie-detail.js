(() => {
  const container =
    document.querySelector(
      "#movieDetail",
    );

  const statusElement =
    document.querySelector(
      "#detailStatus",
    );

  const movieId =
    new URLSearchParams(
      window.location.search,
    ).get("id");

  const state = {
    movies: [],
    history: [],
    movie: null,
  };

  const {
    askForPin,
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

  function movieHistory() {
    return state.history
      .filter(
        (entry) =>
          entry.movie_id ===
          state.movie.id,
      )
      .sort((a, b) =>
        b.watched_at.localeCompare(
          a.watched_at,
        ),
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
                  <p>${formatDate(entry.watched_at)}</p>
                  <span>
                    ${entry.watched_in_theater
              ? "Watched in a theater"
              : "Watched elsewhere"
            }
                  </span>
                </div>

                <i
                  data-lucide="${entry.watched_in_theater
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

  function render() {
    const movie = state.movie;

    document.title =
      `${movie.title} — Seenetrica`;

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
          ${escapeHtml(movie.status)} ·
          ${escapeHtml(movie.media_type)}
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

          ${movie.external_source === "tmdb"
        ? '<span class="detail-fact">TMDB entry</span>'
        : '<span class="detail-fact">Manual entry</span>'
      }
        </div>

        <section class="review-block">
          <p class="section-kicker">
            Review & impression
          </p>

          <h2>What stayed</h2>

          <p class="review-copy">
            ${movie.review
        ? `“${escapeHtml(movie.review)}”`
        : "No impression has been written yet."
      }
          </p>
        </section>

        <section class="viewing-block">
          <p class="section-kicker">
            Screenings
          </p>

          <h2>Viewing history</h2>

          ${renderViewings()}

          <form
            id="viewingForm"
            class="form-grid"
            style="margin-top: 24px"
          >
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
              <input
                id="newWatchedInTheater"
                type="checkbox"
              />
              Watched in a theater
            </label>

            <div class="form-actions is-full">
              <button
                class="secondary-button"
                type="submit"
              >
                <i data-lucide="plus" aria-hidden="true"></i>
                Add viewing
              </button>
            </div>
          </form>
        </section>

        <section class="edit-block">
          <p class="section-kicker">
            Personal notes
          </p>

          <h2>Edit this entry</h2>

          <form
            id="editMovieForm"
            class="form-grid"
          >
            <label class="form-field is-full">
              <span>Title</span>
              <input
                id="editTitle"
                value="${escapeHtml(movie.title)}"
                required
              />
            </label>

            <label class="form-field">
              <span>Status</span>

              <select id="editStatus">
                <option
                  value="plan"
                  ${movie.status === "plan" ? "selected" : ""}
                >
                  Planned
                </option>

                <option
                  value="watchlist"
                  ${movie.status === "watchlist" ? "selected" : ""}
                >
                  Watchlist
                </option>

                <option
                  value="watched"
                  ${movie.status === "watched" ? "selected" : ""}
                >
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
              <button
                class="primary-button"
                type="submit"
              >
                <i data-lucide="save" aria-hidden="true"></i>
                Save changes
              </button>
            </div>
          </form>
        </section>
      </div>
    `;

    bindForms();
    refreshIcons();
  }

  async function reloadMovie() {
    const data = await getData(true);

    state.movies = data.movies;
    state.history = data.history;

    state.movie =
      state.movies.find(
        (movie) =>
          movie.id === movieId,
      );

    if (!state.movie) {
      throw new Error(
        "Movie was not found.",
      );
    }

    render();
  }

  function bindForms() {
    document
      .querySelector("#viewingForm")
      .addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          const pin =
            askForPin();

          if (pin === null) {
            return;
          }

          const button =
            event.currentTarget.querySelector(
              'button[type="submit"]',
            );

          button.disabled = true;

          try {
            await writeData(
              "addViewing",
              {
                movie_id:
                  state.movie.id,
                watched_at:
                  document.querySelector(
                    "#newWatchedAt",
                  ).value,
                watched_in_theater:
                  document.querySelector(
                    "#newWatchedInTheater",
                  ).checked,
              },
              pin,
            );

            await reloadMovie();

            showToast(
              "Viewing added to history.",
            );
          } catch (error) {
            console.error(error);

            showToast(
              error.message,
              "error",
            );

            button.disabled = false;
          }
        },
      );

    document
      .querySelector(
        "#editMovieForm",
      )
      .addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          const pin =
            askForPin();

          if (pin === null) {
            return;
          }

          const button =
            event.currentTarget.querySelector(
              'button[type="submit"]',
            );

          const ratingValue =
            document.querySelector(
              "#editRating",
            ).value;

          button.disabled = true;

          try {
            await writeData(
              "updateMovie",
              {
                id: state.movie.id,
                title:
                  document
                    .querySelector(
                      "#editTitle",
                    )
                    .value.trim(),
                status:
                  document.querySelector(
                    "#editStatus",
                  ).value,
                rating:
                  ratingValue === ""
                    ? null
                    : Number(
                      ratingValue,
                    ),
                review:
                  document
                    .querySelector(
                      "#editReview",
                    )
                    .value.trim() ||
                  null,
              },
              pin,
            );

            await reloadMovie();

            showToast(
              "Movie entry updated.",
            );
          } catch (error) {
            console.error(error);

            showToast(
              error.message,
              "error",
            );

            button.disabled = false;
          }
        },
      );
  }

  if (!movieId) {
    statusElement.classList.add(
      "error-state",
    );

    statusElement.innerHTML = `
      <p>
        No movie was selected.<br />
        <a
          class="section-link"
          href="../index.html"
        >
          Return home
        </a>
      </p>
    `;

    return;
  }

  getData()
    .then((data) => {
      state.movies = data.movies;
      state.history = data.history;

      state.movie =
        state.movies.find(
          (movie) =>
            movie.id === movieId,
        );

      if (!state.movie) {
        throw new Error(
          "Movie not found.",
        );
      }

      render();
    })
    .catch((error) => {
      console.error(error);

      statusElement.classList.add(
        "error-state",
      );

      statusElement.innerHTML = `
        <p>
          This movie could not be found.<br />
          <a
            class="section-link"
            href="../index.html"
          >
            Return home
          </a>
        </p>
      `;
    });
})();