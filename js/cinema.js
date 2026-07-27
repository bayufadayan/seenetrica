(() => {
  const state = {
    movies: [],
    history: [],
  };

  const list = document.querySelector("#cinemaList");
  const status = document.querySelector("#cinemaStatus");
  const count = document.querySelector("#cinemaCount");

  const {
    detailLink,
    escapeHtml,
    fallbackPoster,
    formatDate,
    formatRuntime,
    getData,
    refreshIcons,
  } = window.Seenetrica;

  function wasWatchedInTheater(value) {
    return value === true || String(value).toLowerCase() === "true";
  }

  function screeningTimestamp(entry) {
    const watchedAt = String(entry.watched_at || "").slice(0, 10);

    if (/^\d{4}-\d{2}-\d{2}$/.test(watchedAt)) {
      return new Date(`${watchedAt}T12:00:00`).getTime();
    }

    const createdAt = new Date(entry.created_at || 0).getTime();
    return Number.isFinite(createdAt) ? createdAt : 0;
  }

  function buildEntries() {
    const movieMap = new Map(
      state.movies.map((movie) => [String(movie.id), movie]),
    );

    return state.history
      .filter((entry) => wasWatchedInTheater(entry.watched_in_theater))
      .map((entry) => ({
        ...entry,
        movie: movieMap.get(String(entry.movie_id)),
      }))
      .filter((entry) => entry.movie)
      .sort((first, second) => {
        const dateDifference =
          screeningTimestamp(second) - screeningTimestamp(first);

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return String(second.created_at || "").localeCompare(
          String(first.created_at || ""),
        );
      });
  }

  function renderEntry(entry, index) {
    const movie = entry.movie;
    const watchedDate = formatDate(entry.watched_at, {
      fallback: "Date unknown",
      month: "long",
    });

    const movieMeta = [
      movie.media_type === "series" ? "Series" : "Movie",
      formatRuntime(movie.runtime_minutes),
    ].join(" · ");

    return `
      <a
        class="cinema-entry"
        href="${detailLink(movie.id)}"
        aria-label="Open ${escapeHtml(movie.title)} details"
      >
        <span class="cinema-entry-number" aria-hidden="true">
          ${String(index + 1).padStart(2, "0")}
        </span>

        <div class="cinema-entry-poster">
          <img
            src="${escapeHtml(movie.poster_url || fallbackPoster)}"
            alt=""
            loading="lazy"
            onerror="this.onerror=null;this.src='${fallbackPoster}'"
          />
        </div>

        <div class="cinema-entry-copy">
          <p>${escapeHtml(movieMeta)}</p>
          <h2>${escapeHtml(movie.title)}</h2>
          <span>
            <i data-lucide="ticket" aria-hidden="true"></i>
            Watched on the big screen
          </span>
        </div>

        <div class="cinema-entry-date">
          <span>Watched</span>
          <time datetime="${escapeHtml(
            String(entry.watched_at || "").slice(0, 10),
          )}">
            ${escapeHtml(watchedDate)}
          </time>
        </div>

        <i
          class="cinema-entry-arrow"
          data-lucide="arrow-up-right"
          aria-hidden="true"
        ></i>
      </a>
    `;
  }

  function render() {
    const entries = buildEntries();

    count.textContent = entries.length;
    status.textContent = `${entries.length} ${
      entries.length === 1 ? "screening" : "screenings"
    } recorded`;

    list.hidden = false;

    if (!entries.length) {
      list.innerHTML = `
        <div class="empty-state">
          <p>No theater viewings have been recorded yet.</p>
        </div>
      `;

      return;
    }

    list.innerHTML = entries.map(renderEntry).join("");
    refreshIcons();
  }

  getData()
    .then((data) => {
      state.movies = data.movies;
      state.history = data.history;
      render();
    })
    .catch((error) => {
      console.error(error);

      count.textContent = "—";
      status.textContent = "The cinema diary could not be loaded.";
      list.hidden = false;
      list.innerHTML = `
        <div class="error-state">
          <p>Run Seenetrica through a local server and try again.</p>
        </div>
      `;
    });
})();
