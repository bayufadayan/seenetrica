(() => {
  const state = { movies: [], search: "", sort: "date" };
  const grid = document.querySelector("#plannedGrid");
  const status = document.querySelector("#plannedStatus");
  const count = document.querySelector("#plannedCount");
  const search = document.querySelector("#plannedSearch");
  const { formatDate, getData, movieCard, refreshIcons } = window.Seenetrica;

  function render() {
    const all = state.movies.filter((movie) => movie.status === "plan");
    const filtered = all
      .filter(
        (movie) =>
          !state.search ||
          movie.title.toLowerCase().includes(state.search.toLowerCase()),
      )
      .sort((a, b) =>
        state.sort === "added"
          ? b.created_at.localeCompare(a.created_at)
          : (a.release_date || "9999").localeCompare(b.release_date || "9999"),
      );

    count.textContent = all.length;
    status.textContent = `${filtered.length} upcoming ${
      filtered.length === 1 ? "title" : "titles"
    } shown`;
    grid.innerHTML = filtered.length
      ? filtered
          .map((movie) =>
            movieCard(movie, {
              subtitle: `${movie.media_type} · ${
                movie.release_date
                  ? `Releases ${formatDate(movie.release_date)}`
                  : "Release date TBA"
              }`,
              dateBadge: movie.release_date
                ? formatDate(movie.release_date, {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })
                : "TBA",
            }),
          )
          .join("")
      : '<div class="empty-state"><p>No planned titles match this view.</p></div>';
    refreshIcons();
  }

  search.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });

  document.querySelector(".tool-chips").addEventListener("click", (event) => {
    const button = event.target.closest("[data-sort]");
    if (!button) return;
    document
      .querySelectorAll("[data-sort]")
      .forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.sort = button.dataset.sort;
    render();
  });

  getData()
    .then((data) => {
      state.movies = data.movies;
      render();
    })
    .catch((error) => {
      console.error(error);
      status.textContent = "The planned list could not be loaded.";
      grid.innerHTML =
        '<div class="error-state"><p>Run Seenetrica through a local server.</p></div>';
    });
})();
