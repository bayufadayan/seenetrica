import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function NotFoundPage() {
  useDocumentTitle("Not found");
  return (
    <section className="page-hero page-shell">
      <div>
        <p className="eyebrow">Nothing at this address</p>
        <h1>
          Page <span>not found.</span>
        </h1>
        <p className="page-hero-description">
          The page may have moved during the Seenetrica migration.
        </p>
        <Link className="primary-button" to="/">
          Return home
        </Link>
      </div>
    </section>
  );
}
