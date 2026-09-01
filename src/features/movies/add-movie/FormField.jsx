export function FormField({ label, full = false, children }) {
  const className = `form-field ${full ? "is-full" : ""}`;

  return (
    <label className={className}>
      <span>{label}</span>
      {children}
    </label>
  );
}
