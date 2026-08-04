import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";
import HistoryPage from "../pages/HistoryPage";
import WatchlistPage from "../pages/WatchlistPage";
import PlannedPage from "../pages/PlannedPage";
import CinemaPage from "../pages/CinemaPage";
import AddMoviePage from "../pages/AddMoviePage";
import MovieDetailPage from "../pages/MovieDetailPage";
import NotFoundPage from "../pages/NotFoundPage";
import WatchMarvelPage from "../pages/WatchMarvelPage";
import WatchMarvelSettingsPage from "../pages/WatchMarvelSettingsPage";
import WatchMarvelPlayerPage from "../pages/WatchMarvelPlayerPage";
import { WatchMarvelFeatureLayout } from "../features/watch-marvel/components/WatchMarvelFeatureLayout";

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
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="planned" element={<PlannedPage />} />
        <Route path="cinema" element={<CinemaPage />} />
        <Route path="add-movie" element={<AddMoviePage />} />
        <Route path="movies/:movieId" element={<MovieDetailPage />} />
        <Route path="watch-marvel" element={<WatchMarvelFeatureLayout />}>
          <Route index element={<WatchMarvelPage />} />
          <Route path="settings" element={<WatchMarvelSettingsPage />} />
        </Route>
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
      <Route path="watch-marvel/player/:sessionId" element={<WatchMarvelPlayerPage />} />
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
