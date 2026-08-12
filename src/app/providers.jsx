import { ArchiveProvider } from "../context/ArchiveContext";
import { ToastProvider } from "../context/ToastContext";
import { CategoriesProvider } from "../features/categories/context/CategoriesProvider";
import { PlayerProvider } from "../features/player/context/PlayerProvider";

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <PlayerProvider>
        <CategoriesProvider>
          <ArchiveProvider>{children}</ArchiveProvider>
        </CategoriesProvider>
      </PlayerProvider>
    </ToastProvider>
  );
}
