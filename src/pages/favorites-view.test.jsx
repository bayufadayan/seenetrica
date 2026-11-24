import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MovieFavoritesPage from "./MovieFavoritesPage";
import LeaderboardsPage from "./LeaderboardsPage";

const { archive } = vi.hoisted(() => ({ archive: {
  movies: [{ id: "numeric", title: 1917, release_date: "2019-12-25", media_type: "movie", rating: 9, status: "watched" },
    { id: "series", title: "Alice in Borderland · Season 1", media_type: "series", release_date: "2020-12-10" }],
  history: [], favorites: [], loading: false, error: null,
} }));
vi.mock("../context/ArchiveContext", () => ({ useArchive: () => archive }));
vi.mock("../context/ToastContext", () => ({ useToast: () => vi.fn() }));

function render(path) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/favorites/movies" element={<MovieFavoritesPage />} />
    <Route path="/favorites/franchises/:franchiseId" element={<MovieFavoritesPage />} />
    <Route path="/leaderboards" element={<LeaderboardsPage />} />
  </Routes></MemoryRouter>);
}

describe("favorites and leaderboard views", () => {
  it("renders numeric movie titles, standalone series and franchises without showing folder children at root", () => {
    archive.favorites = [
      { id: "a", kind: "movie", item_id: "numeric", sort_order: 1 },
      { id: "folder", kind: "movie", entry_type: "franchise", name: "My franchise", sort_order: 2 },
      { id: "b", kind: "movie", parent_id: "folder", item_id: "series", sort_order: 1 },
    ];
    const root = render("/favorites/movies");
    expect(root).toContain("1917");
    expect(root).toContain("My franchise");
    expect(root).not.toContain("Alice in Borderland");
    const folder = render("/favorites/franchises/folder");
    expect(folder).toContain("Alice in Borderland");
    expect(folder).toContain("Copy timeline");
  });

  it("uses release year for a watched numeric title without viewing dates", () => {
    const html = render("/leaderboards");
    expect(html).toContain("1917");
    expect(html).toContain("2019");
    expect(html).toContain("Top rated");
  });
});
