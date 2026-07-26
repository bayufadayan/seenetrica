(() => {
  const state = {
    movies: [],
    history: [],
    search: "",
    date: "",
    month: "",
    year: "",
  };

  const container = document.querySelector("#historyGroups");
  const status = document.querySelector("#historyStatus");
  const count = document.querySelector("#historyCount");
  const searchInput = document.querySelector("#historyPageSearch");
  const dateFilter = document.querySelector("#dateFilter");
  const monthFilter = document.querySelector("#monthFilter");
  const yearFilter = document.querySelector("#yearFilter");
  const filterToggle = document.querySelector("[data-filter-toggle]");
  const filterPanel = document.querySelector("[data-filter-panel]");

  const { formatDate, getData, movieCard, refreshIcons } = window.Seenetrica;

  function buildEntries() {
    const movieMap = new Map(state.movies.map((movie) => [movie.id, movie]));
    return state.history
      .map((entry) => ({ ...entry, movie: movieMap.get(entry.movie_id) }))
      .filter((entry) => entry.movie)
      .sort((a, b) => b.watched_at.localeCompare(a.watched_at));
  }

  function filteredEntries() {
    return buildEntries().filter((entry) => {
      const [year, month] = entry.watched_at.split("-");
      return (
        (!state.search ||
          entry.movie.title
            .toLowerCase()
            .includes(state.search.toLowerCase())) &&
        (!state.date || entry.watched_at === state.date) &&
        (!state.month || month === state.month) &&
        (!state.year || year === state.year)
      );
    });
  }

  function render() {
    const entries = filteredEntries();
    status.hidden = true;
    container.hidden = false;
    count.textContent = state.history.length;

    if (!entries.length) {
      container.innerHTML =
        '<div class="empty-state"><p>No history entries match your filters.</p></div>';
      return;
    }

    const years = entries.reduce((result, entry) => {
      const year = entry.watched_at.slice(0, 4);
      result[year] ||= [];
      result[year].push(entry);
      return result;
    }, {});

    container.innerHTML = Object.entries(years)
      .map(
        ([year, yearEntries]) => `
          <section class="month-group">
            <div class="month-heading">
              <h3>${year}</h3>
              <span>${yearEntries.length} ${yearEntries.length === 1 ? "entry" : "entries"}</span>
            </div>
            <div class="collection-grid">
              ${yearEntries
                .map((entry) =>
                  movieCard(entry.movie, {
                    inTheater: entry.watched_in_theater,
                    subtitle: `${entry.movie.media_type} · ${formatDate(entry.watched_at)}`,
                  }),
                )
                .join("")}
            </div>
          </section>
        `,
      )
      .join("");
    refreshIcons();
  }

  function populateYears() {
    const years = [
      ...new Set(state.history.map((entry) => entry.watched_at.slice(0, 4))),
    ].sort((a, b) => b.localeCompare(a));
    yearFilter.innerHTML = `
      <option value="">All years</option>
      ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
    `;
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
  document.querySelector("#clearFilters").addEventListener("click", () => {
    state.search = "";
    state.date = "";
    state.month = "";
    state.year = "";
    searchInput.value = "";
    dateFilter.value = "";
    monthFilter.value = "";
    yearFilter.value = "";
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
