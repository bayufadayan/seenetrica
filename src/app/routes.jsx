import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";
import HistoryPage from "../pages/HistoryPage";
import WatchlistPage from "../pages/WatchlistPage";
import PlannedPage from "../pages/PlannedPage";
import CinemaPage from "../pages/CinemaPage";
import AllMoviesPage from "../pages/AllMoviesPage";
import AddMoviePage from "../pages/AddMoviePage";
import LogViewingPage from "../pages/LogViewingPage";
import MovieDetailPage from "../pages/MovieDetailPage";
import NotFoundPage from "../pages/NotFoundPage";
import CategoryPage from "../pages/CategoryPage";
import CategorySettingsPage from "../pages/CategorySettingsPage";
import WatchAnythingPage from "../pages/WatchAnythingPage";
import PlayerPage from "../pages/PlayerPage";
import SeriesPage from "../pages/SeriesPage";
import SeriesDetailPage from "../pages/SeriesDetailPage";
import CategoriesPage from "../pages/CategoriesPage";
import UnknownDateHistoryPage from "../pages/UnknownDateHistoryPage";
import LeaderboardsPage from "../pages/LeaderboardsPage";

function LegacyDetailRedirect() {
  const [params] = useSearchParams();
  const id = params.get("id");
  return id ? (
    <Navigate replace to={`/movies/${encodeURIComponent(id)}`} />
  ) : (
    <Navigate replace to="/" />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="index.html" element={<Navigate replace to="/" />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/unknown-date" element={<UnknownDateHistoryPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="planned" element={<PlannedPage />} />
        <Route path="cinema" element={<CinemaPage />} />
        <Route path="movies" element={<AllMoviesPage />} />
        <Route path="leaderboards" element={<LeaderboardsPage />} />
        <Route path="add-movie" element={<AddMoviePage />} />
        <Route path="log-viewing" element={<LogViewingPage />} />
        <Route path="movies/:movieId" element={<MovieDetailPage />} />
        <Route path="categories/:categorySlug" element={<CategoryPage />} />
        <Route path="categories/:categorySlug/settings" element={<CategorySettingsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="series" element={<SeriesPage />} />
        <Route path="series/:categorySlug" element={<SeriesDetailPage />} />
        <Route path="watch-anything" element={<WatchAnythingPage />} />
        <Route path="watch-marvel" element={<Navigate replace to="/categories/marvel" />} />
        <Route path="watch-marvel/settings" element={<Navigate replace to="/categories/marvel/settings" />} />
        <Route
          path="pages/history.html"
          element={<Navigate replace to="/history" />}
        />
        <Route
          path="pages/watchlist.html"
          element={<Navigate replace to="/watchlist" />}
        />
        <Route
          path="pages/planned.html"
          element={<Navigate replace to="/planned" />}
        />
        <Route
          path="pages/cinema.html"
          element={<Navigate replace to="/cinema" />}
        />
        <Route path="pages/add-movie.html" element={<LegacyAddRedirect />} />
        <Route
          path="pages/movie-detail.html"
          element={<LegacyDetailRedirect />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="watch-anything/player/:sessionId" element={<PlayerPage />} />
      <Route path="watch-marvel/player/:sessionId" element={<PlayerPage />} />
    </Routes>
  );
}

function LegacyAddRedirect() {
  const [params] = useSearchParams();
  return (
    <Navigate
      replace
      to={`/add-movie${params.toString() ? `?${params}` : ""}`}
    />
  );
}
