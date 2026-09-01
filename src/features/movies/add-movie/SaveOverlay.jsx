export function SaveOverlay({ progress }) {
  if (!progress) return null;

  return (
    <div className="save-overlay" role="status" aria-live="assertive">
      <div className="save-overlay-card">
        <span className="loading-spinner" aria-hidden="true" />
        <strong>{progress.message}</strong>
        <p>{progress.detail}</p>
      </div>
    </div>
  );
}
