export function PageHero({
  eyebrow,
  title,
  accent,
  description,
  count,
  countLabel,
}) {
  return (
    <section className="page-hero page-shell">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>
          {title} <span>{accent}</span>
        </h1>
        <p className="page-hero-description">{description}</p>
      </div>
      <div className="page-stat">
        <strong>{count}</strong>
        <span>{countLabel}</span>
      </div>
    </section>
  );
}
