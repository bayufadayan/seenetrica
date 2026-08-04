import { ArchiveProvider } from "../context/ArchiveContext";
import { ToastProvider } from "../context/ToastContext";

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <ArchiveProvider>{children}</ArchiveProvider>
    </ToastProvider>
  );
}
