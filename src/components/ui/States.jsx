export function LoadingState({ children = "Loading…" }) {
  return (
    <div className="loading-state" role="status">
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="empty-state">
      <p>{children}</p>
    </div>
  );
}

export function ErrorState({ children }) {
  return (
    <div className="error-state" role="alert">
      <p>{children}</p>
    </div>
  );
}
