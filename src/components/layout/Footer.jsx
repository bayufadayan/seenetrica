import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-inner">
        <div>
          <Link className="footer-brand" to="/">
            Seenetrica
          </Link>
          <p>A quiet place for the stories that stay.</p>
        </div>
        <div className="footer-socials" aria-label="Social links">
          <a
            href="https://instagram.com/bayufadayan"
            target="_blank"
            rel="noreferrer"
          >
            Instagram <ArrowUpRight aria-hidden="true" />
          </a>
          <a
            href="https://github.com/bayufadayan"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
        <div className="tmdb-credit">
          <img
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bd31c45a7e02d9b36e700afdc2f5911c72cd6ca3099434fb8441c5c4e342e53.svg"
            alt="TMDB"
          />
          <p>
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
        </div>
        <p className="footer-copyright">
          © {new Date().getFullYear()} Seenetrica
        </p>
      </div>
    </footer>
  );
}
