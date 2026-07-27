(() => {
  const state = {
    movies: [],
    history: [],
    search: "",
    date: "",
    month: "",
    year: "",
    groupBy: "month",
    sort: "newest",
  };

  const container = document.querySelector("#historyGroups");
  const status = document.querySelector("#historyStatus");
  const count = document.querySelector("#historyCount");
  const searchInput = document.querySelector("#historyPageSearch");
  const dateFilter = document.querySelector("#dateFilter");
  const monthFilter = document.querySelector("#monthFilter");
  const yearFilter = document.querySelector("#yearFilter");
  const groupBySelect = document.querySelector("#groupBySelect");
  const sortSelect = document.querySelector("#sortSelect");
  const filterToggle = document.querySelector("[data-filter-toggle]");
  const filterPanel = document.querySelector("[data-filter-panel]");

  const {
    addMovieLink,
    formatDate,
    getData,
    movieCard,
    refreshIcons,
  } = window.Seenetrica;

  function validWatchedDate(value) {
    const date = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }

  function buildEntries() {
    const movieMap = new Map(
      state.movies.map((movie) => [String(movie.id), movie]),
    );

    return state.history
      .map((entry) => ({
        ...entry,
        watched_at: validWatchedDate(entry.watched_at),
        movie: movieMap.get(String(entry.movie_id)),
      }))
      .filter((entry) => entry.movie && entry.watched_at);
  }

  function filteredEntries() {
    const direction = state.sort === "oldest" ? 1 : -1;

    return buildEntries()
      .filter((entry) => {
        const [year, month] = entry.watched_at.split("-");
        const title = entry.movie.title.toLowerCase();

        return (
          (!state.search || title.includes(state.search.toLowerCase())) &&
          (!state.date || entry.watched_at === state.date) &&
          (!state.month || month === state.month) &&
          year === state.year
        );
      })
      .sort((first, second) =>
        first.watched_at.localeCompare(second.watched_at) * direction,
      );
  }

  function formatMonthHeading(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  }

  function renderCard(entry) {
    return movieCard(entry.movie, {
      inTheater: entry.watched_in_theater,
      subtitle: `${entry.movie.media_type} · ${formatDate(entry.watched_at)}`,
    });
  }

  function renderMonthGroup(monthKey, entries) {
    const label = formatMonthHeading(monthKey);

    return `
      <section class="month-group">
        <div class="month-heading">
          <h3>${label}</h3>

          <span>
            ${entries.length}
            ${entries.length === 1 ? "entry" : "entries"}
          </span>

          <a
            class="group-add-button"
            href="${addMovieLink({ intent: "watched", period: monthKey })}"
            aria-label="Add a watched title to ${label}"
            title="Add to ${label}"
          >
            <i data-lucide="plus" aria-hidden="true"></i>
          </a>
        </div>

        <div class="collection-grid">
          ${entries.map(renderCard).join("")}
        </div>
      </section>
    `;
  }

  function renderGrouped(entries) {
    const groups = entries.reduce((result, entry) => {
      const monthKey = entry.watched_at.slice(0, 7);
      result[monthKey] ||= [];
      result[monthKey].push(entry);
      return result;
    }, {});

    return Object.entries(groups)
      .map(([monthKey, monthEntries]) =>
        renderMonthGroup(monthKey, monthEntries),
      )
      .join("");
  }

  function render() {
    const entries = filteredEntries();

    status.hidden = true;
    container.hidden = false;
    count.textContent = entries.length;

    if (!entries.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No history entries match this view.</p>
        </div>
      `;
      return;
    }

    container.innerHTML =
      state.groupBy === "month"
        ? renderGrouped(entries)
        : `
          <div class="collection-grid history-ungrouped-grid">
            ${entries.map(renderCard).join("")}
          </div>
        `;

    refreshIcons();
  }

  function populateYears() {
    const years = [
      ...new Set(
        buildEntries().map((entry) => entry.watched_at.slice(0, 4)),
      ),
    ].sort((first, second) => second.localeCompare(first));

    state.year = years[0] || String(new Date().getFullYear());

    yearFilter.innerHTML = years.length
      ? years
          .map(
            (year) => `
              <option value="${year}" ${year === state.year ? "selected" : ""}>
                ${year}
              </option>
            `,
          )
          .join("")
      : `<option value="${state.year}">${state.year}</option>`;
  }

  function resetView() {
    state.search = "";
    state.date = "";
    state.month = "";
    state.groupBy = "month";
    state.sort = "newest";

    searchInput.value = "";
    dateFilter.value = "";
    monthFilter.value = "";
    groupBySelect.value = "month";
    sortSelect.value = "newest";
  }

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });

  dateFilter.addEventListener("change", (event) => {
    state.date = event.target.value;
    render();
  });

  monthFilter.addEventListener("change", (event) => {
    state.month = event.target.value;
    render();
  });

  yearFilter.addEventListener("change", (event) => {
    state.year = event.target.value;
    render();
  });

  groupBySelect.addEventListener("change", (event) => {
    state.groupBy = event.target.value;
    render();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  document.querySelector("#clearFilters").addEventListener("click", () => {
    resetView();
    render();
  });

  filterToggle.addEventListener("click", () => {
    const open = filterPanel.classList.toggle("is-open");
    filterToggle.setAttribute("aria-expanded", String(open));
  });

  getData()
    .then((data) => {
      state.movies = data.movies;
      state.history = data.history;
      populateYears();
      render();
    })
    .catch((error) => {
      console.error(error);
      status.textContent = "The watch history could not be loaded.";
      status.classList.add("error-state");
    });
})();
