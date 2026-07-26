(() => {
  const state = { movies: [], search: "", type: "" };
  const grid = document.querySelector("#watchlistGrid");
  const status = document.querySelector("#watchlistStatus");
  const count = document.querySelector("#watchlistCount");
  const search = document.querySelector("#watchlistSearch");
  const { getData, movieCard, refreshIcons } = window.Seenetrica;

  function render() {
    const all = state.movies.filter((movie) => movie.status === "watchlist");
    const filtered = all
      .filter(
        (movie) =>
          (!state.search ||
            movie.title.toLowerCase().includes(state.search.toLowerCase())) &&
          (!state.type || movie.media_type === state.type),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    count.textContent = all.length;
    status.textContent = `${filtered.length} ${
      filtered.length === 1 ? "title" : "titles"
    } shown`;
    grid.innerHTML = filtered.length
      ? filtered
          .map((movie) =>
            movieCard(movie, {
              subtitle: `${movie.media_type} · ${
                movie.runtime_minutes
                  ? `${movie.runtime_minutes} min`
                  : movie.release_date?.slice(0, 4) || "TBA"
              }`,
            }),
          )
          .join("")
      : '<div class="empty-state"><p>No watchlist titles match this view.</p></div>';
    refreshIcons();
  }

  search.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });

  document.querySelector(".tool-chips").addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    document
      .querySelectorAll("[data-type]")
      .forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.type = button.dataset.type;
    render();
  });

  getData()
    .then((data) => {
      state.movies = data.movies;
      render();
    })
    .catch((error) => {
      console.error(error);
      status.textContent = "The watchlist could not be loaded.";
      grid.innerHTML =
        '<div class="error-state"><p>Run Seenetrica through a local server.</p></div>';
    });
})();
