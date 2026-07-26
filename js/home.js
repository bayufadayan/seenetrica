(() => {
  const MONTHS_PER_PAGE = 6;

  const state = {
    movies: [],
    history: [],
    search: "",
    date: "",
    month: "",
    year: "",
    page: 1,
  };

  const groups = document.querySelector("#historyGroups");
  const status = document.querySelector("#historyStatus");
  const plannedList = document.querySelector("#plannedList");
  const watchlistList = document.querySelector("#watchlistList");
  const watchedCount = document.querySelector("#watchedCount");
  const searchInput = document.querySelector("#historySearch");
  const dateFilter = document.querySelector("#dateFilter");
  const monthFilter = document.querySelector("#monthFilter");
  const yearFilter = document.querySelector("#yearFilter");
  const filterToggle = document.querySelector("[data-filter-toggle]");
  const filterPanel = document.querySelector("[data-filter-panel]");

  const {
    detailLink,
    escapeHtml,
    fallbackPoster,
    formatDate,
    getData,
    movieCard,
    refreshIcons,
  } = window.Seenetrica;

  function entries() {
    const moviesById = new Map(
      state.movies.map((movie) => [movie.id, movie]),
    );

    return state.history
      .map((entry) => ({
        ...entry,
        movie: moviesById.get(entry.movie_id),
      }))
      .filter((entry) => entry.movie)
      .filter((entry) => {
        const [year, month] = entry.watched_at.split("-");
        const title = entry.movie.title.toLowerCase();

        const matchesSearch =
          !state.search || title.includes(state.search.toLowerCase());

        const matchesDate =
          !state.date || entry.watched_at === state.date;

        const matchesMonth =
          !state.month || month === state.month;

        const matchesYear =
          !state.year || year === state.year;

        return (
          matchesSearch &&
          matchesDate &&
          matchesMonth &&
          matchesYear
        );
      })
      .sort((a, b) => b.watched_at.localeCompare(a.watched_at));
  }

  function groupEntriesByMonth(historyEntries) {
    return historyEntries.reduce((result, entry) => {
      const monthKey = entry.watched_at.slice(0, 7);

      result[monthKey] ||= [];
      result[monthKey].push(entry);

      return result;
    }, {});
  }

  function formatMonthHeading(monthKey) {
    const [year, month] = monthKey.split("-");

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(Number(year), Number(month) - 1, 1));
  }

  function renderMonthGroup(monthKey, monthEntries) {
    const label = formatMonthHeading(monthKey);

    return `
      <section class="month-group">
        <div class="month-heading">
          <h3>${label}</h3>

          <span>
            ${monthEntries.length}
            ${monthEntries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div class="movie-grid">
          ${monthEntries
        .map((entry) =>
          movieCard(entry.movie, {
            inTheater: entry.watched_in_theater,
            subtitle: `${entry.movie.media_type
              } · ${formatDate(entry.watched_at)}`,
          }),
        )
        .join("")}
        </div>
      </section>
    `;
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      return "";
    }

    const previousDisabled = state.page === 1;
    const nextDisabled = state.page === totalPages;

    return `
      <nav
        class="form-actions"
        aria-label="Watch history pagination"
      >
        <button
          class="secondary-button"
          type="button"
          data-page-direction="previous"
          ${previousDisabled ? "disabled" : ""}
        >
          <i data-lucide="arrow-left" aria-hidden="true"></i>
          Previous
        </button>

        <span class="rating">
          Page ${state.page} of ${totalPages}
        </span>

        <button
          class="secondary-button"
          type="button"
          data-page-direction="next"
          ${nextDisabled ? "disabled" : ""}
        >
          Next
          <i data-lucide="arrow-right" aria-hidden="true"></i>
        </button>
      </nav>
    `;
  }

  function renderHistory() {
    const filteredEntries = entries();

    status.hidden = true;
    groups.hidden = false;

    if (!filteredEntries.length) {
      state.page = 1;

      groups.innerHTML = `
        <div class="empty-state">
          <p>No watch history matches these filters.</p>
        </div>
      `;

      return;
    }

    const monthlyGroups = groupEntriesByMonth(filteredEntries);
    const monthEntries = Object.entries(monthlyGroups);

    const totalPages = Math.ceil(
      monthEntries.length / MONTHS_PER_PAGE,
    );

    if (state.page > totalPages) {
      state.page = totalPages;
    }

    const startIndex = (state.page - 1) * MONTHS_PER_PAGE;
    const endIndex = startIndex + MONTHS_PER_PAGE;

    const visibleMonths = monthEntries.slice(
      startIndex,
      endIndex,
    );

    const monthMarkup = visibleMonths
      .map(([monthKey, entriesInMonth]) =>
        renderMonthGroup(monthKey, entriesInMonth),
      )
      .join("");

    groups.innerHTML = `
      ${monthMarkup}
      ${renderPagination(totalPages)}
    `;

    refreshIcons();
  }

  function compactCard(movie, planned = false) {
    const description = planned
      ? formatDate(movie.release_date, {
        fallback: "Release date TBA",
      })
      : `${movie.media_type} · ${movie.runtime_minutes
        ? `${movie.runtime_minutes} min`
        : "Runtime TBA"
      }`;

    return `
      <a
        class="compact-card"
        href="${detailLink(movie.id)}"
      >
        <div class="compact-poster">
          <img
            src="${escapeHtml(
      movie.poster_url || fallbackPoster,
    )}"
            alt=""
            loading="lazy"
            onerror="this.onerror=null;this.src='${fallbackPoster}'"
          />
        </div>

        <div class="compact-copy">
          <h3>${escapeHtml(movie.title)}</h3>
          <p>${escapeHtml(description)}</p>
        </div>
      </a>
    `;
  }

  function renderAside(container, items, planned = false) {
    if (!items.length) {
      container.innerHTML = `
        <p class="compact-loading">
          No ${planned ? "planned" : "watchlist"} titles yet.
        </p>
      `;

      return;
    }

    container.innerHTML = items
      .slice(0, 3)
      .map((movie) => compactCard(movie, planned))
      .join("");
  }

  function populateYears() {
    const years = [
      ...new Set(
        state.history.map((entry) =>
          entry.watched_at.slice(0, 4),
        ),
      ),
    ].sort((a, b) => b.localeCompare(a));

    yearFilter.innerHTML = `
      <option value="">All years</option>

      ${years
        .map(
          (year) => `
            <option value="${year}">
              ${year}
            </option>
          `,
        )
        .join("")}
    `;
  }

  function render() {
    const planned = state.movies
      .filter((movie) => movie.status === "plan")
      .sort((a, b) =>
        (a.release_date || "9999").localeCompare(
          b.release_date || "9999",
        ),
      );

    const watchlist = state.movies
      .filter((movie) => movie.status === "watchlist")
      .sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );

    const watched = state.movies.filter(
      (movie) => movie.status === "watched",
    );

    watchedCount.textContent = watched.length;

    renderAside(plannedList, planned, true);
    renderAside(watchlistList, watchlist);
    populateYears();
    renderHistory();
  }

  function resetPagination() {
    state.page = 1;
  }

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    resetPagination();
    renderHistory();
  });

  dateFilter.addEventListener("change", (event) => {
    state.date = event.target.value;
    resetPagination();
    renderHistory();
  });

  monthFilter.addEventListener("change", (event) => {
    state.month = event.target.value;
    resetPagination();
    renderHistory();
  });

  yearFilter.addEventListener("change", (event) => {
    state.year = event.target.value;
    resetPagination();
    renderHistory();
  });

  document
    .querySelector("#clearFilters")
    .addEventListener("click", () => {
      state.search = "";
      state.date = "";
      state.month = "";
      state.year = "";
      state.page = 1;

      searchInput.value = "";
      dateFilter.value = "";
      monthFilter.value = "";
      yearFilter.value = "";

      renderHistory();
    });

  filterToggle.addEventListener("click", () => {
    const open = filterPanel.classList.toggle("is-open");

    filterToggle.setAttribute(
      "aria-expanded",
      String(open),
    );
  });

  groups.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-page-direction]",
    );

    if (!button || button.disabled) {
      return;
    }

    const direction = button.dataset.pageDirection;

    if (direction === "previous") {
      state.page -= 1;
    }

    if (direction === "next") {
      state.page += 1;
    }

    renderHistory();

    document
      .querySelector(".history-heading")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  });

  getData()
    .then((data) => {
      state.movies = data.movies;
      state.history = data.history;

      render();
    })
    .catch((error) => {
      console.error(error);

      status.innerHTML = `
        <p>
          The archive could not be loaded.<br />
          Run the project through a local server.
        </p>
      `;
    });
})();