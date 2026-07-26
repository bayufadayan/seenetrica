(() => {
  const MOVIES_KEY =
    "seenetrica-movies";

  const HISTORY_KEY =
    "seenetrica-watch-history";

  const SEARCH_HISTORY_KEY =
    "seenetrica-search-history";

  const SESSION_PIN_KEY =
    "seenetrica-session-pin";

  const MAX_RECENT_SEARCHES = 5;

  const FALLBACK_POSTER =
    "https://placehold.co/500x750/191917/F4F0E7?text=No+Poster";

  const body = document.body;
  const root = body.dataset.root || ".";
  const activePage =
    body.dataset.page || "home";

  let searchableMovies = [];
  let dataPromise = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function link(path) {
    return `${root}/${path}`.replace(
      "/./",
      "/",
    );
  }

  function detailLink(id) {
    return `${link("pages/movie-detail.html")}?id=${encodeURIComponent(id)}`;
  }

  function renderChrome() {
    const navItems = [
      ["home", "Home", "index.html"],
      [
        "history",
        "History",
        "pages/history.html",
      ],
      [
        "watchlist",
        "Watchlist",
        "pages/watchlist.html",
      ],
      [
        "planned",
        "Planned",
        "pages/planned.html",
      ],
    ];

    const header =
      document.createElement("header");

    header.className = "site-header";

    header.innerHTML = `
      <nav class="floating-nav" aria-label="Primary navigation">
        <a
          class="brand"
          href="${link("index.html")}"
          aria-label="Seenetrica home"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
          >
            S
          </span>

          <span class="brand-name">
            Seenetrica
          </span>
        </a>

        <div
          class="nav-links"
          data-nav-links
        >
          ${navItems
        .map(
          ([page, label, path]) => `
                <a
                  class="nav-link ${activePage === page
              ? "is-active"
              : ""
            }"
                  href="${link(path)}"
                >
                  ${label}
                </a>
              `,
        )
        .join("")}
        </div>

        <div class="nav-actions">
          <a
            class="icon-button"
            href="${link("pages/add-movie.html")}"
            aria-label="Add movie"
            title="Add movie"
          >
            <i
              data-lucide="plus"
              aria-hidden="true"
            ></i>
          </a>

          <button
            class="icon-button"
            type="button"
            aria-label="Search archive"
            data-search-open
          >
            <i
              data-lucide="search"
              aria-hidden="true"
            ></i>
          </button>

          <button
            class="icon-button menu-button"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded="false"
            data-menu-toggle
          >
            <i
              data-lucide="menu"
              aria-hidden="true"
            ></i>
          </button>
        </div>
      </nav>
    `;

    const footer =
      document.createElement("footer");

    footer.className = "site-footer";

    footer.innerHTML = `
      <div class="page-shell footer-inner">
        <div>
          <a
            class="footer-brand"
            href="${link("index.html")}"
          >
            Seenetrica
          </a>

          <p>
            A quiet place for the stories that stay.
          </p>
        </div>

        <div
          class="footer-socials"
          aria-label="Social links"
        >
          <a
            href="https://instagram.com/bayufadayan"
            target="_blank"
            rel="noreferrer"
          >
            Instagram

            <i
              data-lucide="arrow-up-right"
              aria-hidden="true"
            ></i>
          </a>

          <a
            href="https://github.com/bayufadayan"
            target="_blank"
            rel="noreferrer"
          >
            GitHub

            <i
              data-lucide="arrow-up-right"
              aria-hidden="true"
            ></i>
          </a>
        </div>

        <div class="tmdb-credit">
          <img
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bd31c45a7e02d9b36e700afdc2f5911c72cd6ca3099434fb8441c5c4e342e53.svg"
            alt="TMDB"
          />

          <p>
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>

        <p class="footer-copyright">
          © <span data-current-year></span> Seenetrica
        </p>
      </div>
    `;

    const modal =
      document.createElement("div");

    modal.className = "search-modal";
    modal.dataset.searchModal = "";
    modal.hidden = true;

    modal.innerHTML = `
      <button
        class="search-backdrop"
        type="button"
        aria-label="Close search"
        data-search-close
      ></button>

      <section
        class="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
      >
        <div class="search-dialog-header">
          <div>
            <p class="section-kicker">
              Search Seenetrica
            </p>

            <h2 id="search-dialog-title">
              Find a title
            </h2>
          </div>

          <button
            class="icon-button light-icon-button"
            type="button"
            aria-label="Close search"
            data-search-close
          >
            <i
              data-lucide="x"
              aria-hidden="true"
            ></i>
          </button>
        </div>

        <label class="modal-search-field">
          <i
            data-lucide="search"
            aria-hidden="true"
          ></i>

          <span class="sr-only">
            Search all saved titles
          </span>

          <input
            type="search"
            autocomplete="off"
            placeholder="Type a movie or series title"
            data-global-search-input
          />
        </label>

        <div
          class="search-content"
          data-recent-searches
        >
          <div class="search-subheading">
            <h3>Recent searches</h3>

            <button
              type="button"
              data-clear-searches
            >
              Clear
            </button>
          </div>

          <div
            class="recent-search-list"
            data-recent-search-list
          ></div>
        </div>

        <div
          class="search-content"
          data-global-search-results
          hidden
        ></div>
      </section>
    `;

    const toastRegion =
      document.createElement("div");

    toastRegion.className =
      "toast-region";

    toastRegion.setAttribute(
      "aria-live",
      "polite",
    );

    toastRegion.dataset.toastRegion =
      "";

    body.prepend(header);

    body.append(
      footer,
      modal,
      toastRegion,
    );

    footer.querySelector(
      "[data-current-year]",
    ).textContent =
      new Date().getFullYear();
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function readStorage(key) {
    try {
      const value = JSON.parse(
        localStorage.getItem(key) ||
        "null",
      );

      return Array.isArray(value)
        ? value
        : null;
    } catch {
      localStorage.removeItem(key);

      return null;
    }
  }

  function cacheData(
    movies,
    history,
  ) {
    localStorage.setItem(
      MOVIES_KEY,
      JSON.stringify(movies),
    );

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history),
    );
  }

  function clearDataCache() {
    localStorage.removeItem(
      MOVIES_KEY,
    );

    localStorage.removeItem(
      HISTORY_KEY,
    );

    searchableMovies = [];
    dataPromise = null;
  }

  async function fetchRemoteData() {
    const response = await fetch(
      "/api/data",
      {
        method: "GET",

        headers: {
          Accept: "application/json",
        },

        cache: "no-store",
      },
    );

    const result =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "The archive could not be loaded.",
      );
    }

    const movies =
      result.data?.movies;

    const history =
      result.data?.watch_history;

    if (
      !Array.isArray(movies) ||
      !Array.isArray(history)
    ) {
      throw new Error(
        "The archive returned an invalid data format.",
      );
    }

    cacheData(movies, history);
    searchableMovies = movies;

    return {
      movies,
      history,
    };
  }

  async function loadData() {
    try {
      return await fetchRemoteData();
    } catch (error) {
      const cachedMovies =
        readStorage(MOVIES_KEY);

      const cachedHistory =
        readStorage(HISTORY_KEY);

      if (
        cachedMovies &&
        cachedHistory
      ) {
        console.warn(
          "Using cached Seenetrica data:",
          error,
        );

        searchableMovies =
          cachedMovies;

        return {
          movies: cachedMovies,
          history: cachedHistory,
        };
      }

      throw error;
    }
  }

  async function getData(
    forceRefresh = false,
  ) {
    if (forceRefresh) {
      dataPromise = null;
    }

    if (!dataPromise) {
      dataPromise =
        loadData().catch(
          (error) => {
            dataPromise = null;
            throw error;
          },
        );
    }

    return dataPromise;
  }

  function getSessionPin() {
    try {
      const pin = window.sessionStorage.getItem(
        SESSION_PIN_KEY,
      );

      return pin?.trim() || null;
    } catch {
      return null;
    }
  }

  function rememberSessionPin(pin) {
    const cleanedPin = String(pin || "").trim();

    if (!cleanedPin) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        SESSION_PIN_KEY,
        cleanedPin,
      );
    } catch {
      // The save still succeeds when sessionStorage is unavailable.
    }
  }

  function forgetSessionPin() {
    try {
      window.sessionStorage.removeItem(
        SESSION_PIN_KEY,
      );
    } catch {
      // Ignore storage restrictions.
    }
  }

  function isPinAuthenticationError(message) {
    return /pin|unauthori[sz]ed|forbidden|authentication/i.test(
      String(message || ""),
    );
  }

  async function writeData(
    action,
    data,
    pin,
  ) {
    const response = await fetch(
      "/api/data",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body: JSON.stringify({
          action,
          data,
          pin,
        }),
      },
    );

    const result =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      !result.success
    ) {
      const message =
        result.message ||
        "The data could not be saved.";

      if (
        getSessionPin() === String(pin || "").trim() &&
        isPinAuthenticationError(message)
      ) {
        forgetSessionPin();
      }

      throw new Error(message);
    }

    rememberSessionPin(pin);
    clearDataCache();

    return result.data;
  }

  function askForPin() {
    const sessionPin = getSessionPin();

    if (sessionPin) {
      return sessionPin;
    }

    const pin = window.prompt(
      "Enter your Seenetrica PIN to save this change:",
    );

    if (pin === null) {
      return null;
    }

    const cleanedPin =
      pin.trim();

    if (!cleanedPin) {
      showToast(
        "PIN is required.",
        "error",
      );

      return null;
    }

    return cleanedPin;
  }

  function today() {
    const now = new Date();

    const local = new Date(
      now.getTime() -
      now.getTimezoneOffset() *
      60000,
    );

    return local
      .toISOString()
      .slice(0, 10);
  }

  function formatDate(
    value,
    options = {},
  ) {
    if (!value) {
      return (
        options.fallback ||
        "TBA"
      );
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month:
          options.month ||
          "short",

        day:
          options.day ||
          "numeric",

        year:
          options.year ||
          "numeric",
      },
    ).format(
      new Date(
        `${value.slice(0, 10)}T12:00:00`,
      ),
    );
  }

  function formatRating(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "N/A";
    }

    const number =
      Number(value);

    return Number.isInteger(number)
      ? String(number)
      : number.toFixed(1);
  }

  function formatRuntime(minutes) {
    if (!minutes) {
      return "Runtime TBA";
    }

    const hours = Math.floor(
      minutes / 60,
    );

    const rest =
      minutes % 60;

    return hours
      ? `${hours}h ${rest}m`
      : `${rest}m`;
  }

  function movieCard(
    movie,
    options = {},
  ) {
    const subtitle =
      options.subtitle ||
      `${movie.media_type} · ${movie.release_date?.slice(
        0,
        4,
      ) || "TBA"
      }`;

    const dateBadge =
      options.dateBadge
        ? `
          <span class="planned-date">
            ${escapeHtml(
          options.dateBadge,
        )}
          </span>
        `
        : "";

    const cinemaBadge =
      options.inTheater
        ? `
          <span class="cinema-badge">
            <i
              data-lucide="clapperboard"
              aria-hidden="true"
            ></i>

            In theaters
          </span>
        `
        : "";

    return `
      <article class="movie-card">
        <a
          class="poster-link"
          href="${detailLink(movie.id)}"
          aria-label="View ${escapeHtml(movie.title)} details"
        >
          <div class="poster-frame">
            <img
              src="${escapeHtml(
      movie.poster_url ||
      FALLBACK_POSTER,
    )}"
              alt="${escapeHtml(movie.title)} poster"
              loading="lazy"
              onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"
            />

            ${cinemaBadge}
            ${dateBadge}
          </div>
        </a>

        <div class="movie-meta">
          <div class="movie-meta-copy">
            <a
              class="movie-title"
              href="${detailLink(movie.id)}"
            >
              ${escapeHtml(movie.title)}
            </a>

            <p class="movie-subtitle">
              ${escapeHtml(subtitle)}
            </p>
          </div>

          <span
            class="rating"
            aria-label="Rating ${formatRating(movie.rating)}"
          >
            <i
              data-lucide="star"
              aria-hidden="true"
            ></i>

            ${formatRating(movie.rating)}
          </span>
        </div>
      </article>
    `;
  }

  function showToast(
    message,
    type = "success",
  ) {
    const region =
      document.querySelector(
        "[data-toast-region]",
      );

    if (!region) {
      return;
    }

    const toast =
      document.createElement("div");

    toast.className =
      `toast ${type === "error"
        ? "is-error"
        : ""
      }`;

    toast.innerHTML = `
      <i
        data-lucide="${type === "error"
        ? "circle-alert"
        : "circle-check"
      }"
        aria-hidden="true"
      ></i>

      <span>
        ${escapeHtml(message)}
      </span>
    `;

    region.append(toast);
    refreshIcons();

    window.setTimeout(
      () => toast.remove(),
      3200,
    );
  }

  function getRecentSearches() {
    try {
      const stored = JSON.parse(
        localStorage.getItem(
          SEARCH_HISTORY_KEY,
        ) || "[]",
      );

      return Array.isArray(stored)
        ? stored
        : [];
    } catch {
      localStorage.removeItem(
        SEARCH_HISTORY_KEY,
      );

      return [];
    }
  }

  function saveSearchTerm(term) {
    const cleanTerm =
      term.trim();

    if (!cleanTerm) {
      return;
    }

    const recent =
      getRecentSearches().filter(
        (item) =>
          item.toLowerCase() !==
          cleanTerm.toLowerCase(),
      );

    recent.unshift(cleanTerm);

    localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify(
        recent.slice(
          0,
          MAX_RECENT_SEARCHES,
        ),
      ),
    );

    renderRecentSearches();
  }

  function renderRecentSearches() {
    const container =
      document.querySelector(
        "[data-recent-search-list]",
      );

    if (!container) {
      return;
    }

    const recent =
      getRecentSearches();

    container.innerHTML =
      recent.length
        ? recent
          .map(
            (term) => `
                <button
                  class="recent-search-chip"
                  type="button"
                  data-recent-term="${escapeHtml(term)}"
                >
                  <i
                    data-lucide="history"
                    aria-hidden="true"
                  ></i>

                  ${escapeHtml(term)}
                </button>
              `,
          )
          .join("")
        : `
          <p class="no-recent-searches">
            No recent searches yet.
          </p>
        `;

    refreshIcons();
  }

  function renderSearchResults(
    query,
  ) {
    const results =
      document.querySelector(
        "[data-global-search-results]",
      );

    const recent =
      document.querySelector(
        "[data-recent-searches]",
      );

    if (!results || !recent) {
      return;
    }

    const normalized = query
      .trim()
      .toLowerCase();

    if (!normalized) {
      results.hidden = true;
      recent.hidden = false;
      results.innerHTML = "";

      return;
    }

    const matches =
      searchableMovies
        .filter((movie) =>
          movie.title
            .toLowerCase()
            .includes(normalized),
        )
        .slice(0, 7);

    recent.hidden = true;
    results.hidden = false;

    results.innerHTML =
      matches.length
        ? matches
          .map(
            (movie) => `
                <a
                  class="search-result-card"
                  href="${detailLink(movie.id)}"
                  data-search-result="${escapeHtml(movie.title)}"
                >
                  <img
                    src="${escapeHtml(
              movie.poster_url ||
              FALLBACK_POSTER,
            )}"
                    alt=""
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"
                  />

                  <div>
                    <h3>
                      ${escapeHtml(movie.title)}
                    </h3>

                    <p>
                      ${escapeHtml(movie.media_type)}
                      ·
                      ${movie.release_date?.slice(
              0,
              4,
            ) || "TBA"
              }
                    </p>
                  </div>

                  <i
                    data-lucide="arrow-up-right"
                    aria-hidden="true"
                  ></i>
                </a>
              `,
          )
          .join("")
        : `
          <p class="search-empty">
            No title found in your archive.
          </p>
        `;

    refreshIcons();
  }

  function bindChrome() {
    const modal =
      document.querySelector(
        "[data-search-modal]",
      );

    const input =
      document.querySelector(
        "[data-global-search-input]",
      );

    const navLinks =
      document.querySelector(
        "[data-nav-links]",
      );

    const menuToggle =
      document.querySelector(
        "[data-menu-toggle]",
      );

    function openSearch() {
      modal.hidden = false;

      body.classList.add(
        "is-modal-open",
      );

      renderRecentSearches();

      window.setTimeout(
        () => input.focus(),
        50,
      );
    }

    function closeSearch() {
      modal.hidden = true;

      body.classList.remove(
        "is-modal-open",
      );

      input.value = "";

      renderSearchResults("");
    }

    document
      .querySelectorAll(
        "[data-search-open]",
      )
      .forEach((button) =>
        button.addEventListener(
          "click",
          openSearch,
        ),
      );

    document
      .querySelectorAll(
        "[data-search-close]",
      )
      .forEach((button) =>
        button.addEventListener(
          "click",
          closeSearch,
        ),
      );

    input.addEventListener(
      "input",
      (event) =>
        renderSearchResults(
          event.target.value,
        ),
    );

    input.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter"
        ) {
          saveSearchTerm(
            event.currentTarget
              .value,
          );
        }
      },
    );

    document
      .querySelector(
        "[data-global-search-results]",
      )
      .addEventListener(
        "click",
        (event) => {
          const result =
            event.target.closest(
              "[data-search-result]",
            );

          if (result) {
            saveSearchTerm(
              result.dataset
                .searchResult,
            );
          }
        },
      );

    document
      .querySelector(
        "[data-recent-search-list]",
      )
      .addEventListener(
        "click",
        (event) => {
          const chip =
            event.target.closest(
              "[data-recent-term]",
            );

          if (!chip) {
            return;
          }

          input.value =
            chip.dataset.recentTerm;

          renderSearchResults(
            chip.dataset.recentTerm,
          );

          input.focus();
        },
      );

    document
      .querySelector(
        "[data-clear-searches]",
      )
      .addEventListener(
        "click",
        () => {
          localStorage.removeItem(
            SEARCH_HISTORY_KEY,
          );

          renderRecentSearches();
        },
      );

    menuToggle.addEventListener(
      "click",
      () => {
        const isOpen =
          navLinks.classList.toggle(
            "is-open",
          );

        menuToggle.setAttribute(
          "aria-expanded",
          String(isOpen),
        );
      },
    );

    navLinks.addEventListener(
      "click",
      () => {
        navLinks.classList.remove(
          "is-open",
        );

        menuToggle.setAttribute(
          "aria-expanded",
          "false",
        );
      },
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          !modal.hidden
        ) {
          closeSearch();
        }

        if (
          event.key === "/" &&
          ![
            "INPUT",
            "TEXTAREA",
            "SELECT",
          ].includes(
            document.activeElement
              ?.tagName,
          )
        ) {
          event.preventDefault();

          const homeSearch =
            document.querySelector(
              "#historySearch",
            );

          if (homeSearch) {
            homeSearch.focus();
          } else {
            openSearch();
          }
        }
      },
    );
  }

  renderChrome();
  bindChrome();
  refreshIcons();

  getData()
    .then(({ movies }) => {
      searchableMovies = movies;
    })
    .catch((error) =>
      console.error(error),
    );

  window.Seenetrica = {
    root,
    link,
    detailLink,
    getData,
    writeData,
    askForPin,
    today,
    formatDate,
    formatRating,
    formatRuntime,
    movieCard,
    escapeHtml,
    refreshIcons,
    showToast,

    fallbackPoster:
      FALLBACK_POSTER,
  };

  window.addEventListener(
    "load",
    refreshIcons,
  );
})();
