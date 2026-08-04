import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { GlobalSearch } from "../components/layout/GlobalSearch";
import { Header } from "../components/layout/Header";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  return (
    <>
      <Header onSearch={openSearch} />
      <main>
        <Outlet />
      </main>
      <Footer />
      <GlobalSearch
        open={searchOpen}
        onOpen={openSearch}
        onClose={closeSearch}
      />
    </>
  );
}
