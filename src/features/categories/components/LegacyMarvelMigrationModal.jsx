import { LoaderCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { archiveService } from "../../../services/archive.service";

const stageLabels = {
  checking_server: "Checking server…",
  uploading_migration: "Uploading Marvel library…",
  verifying_migration: "Verifying migration…",
  refreshing_cache: "Refreshing local cache…",
};

function legacyTypeLabel(title) {
  if (title.type !== "series") return "Movie";
  return title.seasonNumber ? `Season ${title.seasonNumber}` : "Series";
}

function releaseYear(title) {
  const year = String(title.releaseDate || "").slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

export function LegacyMarvelMigrationDialog({ migration, onMigrate, onDismiss }) {
  const [query, setQuery] = useState("");
  const busy = migration.status === "migrating";
  const titles = useMemo(() => migration.titles || [], [migration.titles]);
  const filteredTitles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return titles;
    return titles.filter((title) =>
      [title.title, title.baseTitle, title.originalTitle]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, titles]);

  return (
    <Modal
      title="Migrate Marvel Films?"
      className="legacy-migration-modal"
      busy={busy}
      onClose={onDismiss}
    >
      <div className="legacy-migration-copy">
        <p>
          Marvel data was found in this browser. These records will be used as the
          source for the first migration to your Spreadsheet.
        </p>
        <p>
          After a verified migration, the Spreadsheet becomes the source of truth.
          The old Marvel IndexedDB records will not be changed or deleted.
        </p>
      </div>

      <dl className="legacy-migration-stats" aria-label="Legacy Marvel summary">
        <div><dt>Total titles</dt><dd>{migration.summary.total}</dd></div>
        <div><dt>Movies</dt><dd>{migration.summary.movies}</dd></div>
        <div><dt>Series / seasons</dt><dd>{migration.summary.series}</dd></div>
        <div><dt>Watched</dt><dd>{migration.summary.watched}</dd></div>
        <div><dt>Unwatched</dt><dd>{migration.summary.unwatched}</dd></div>
        <div><dt>Prerequisites</dt><dd>{migration.summary.prerequisites}</dd></div>
      </dl>

      <label className="legacy-migration-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search legacy Marvel titles</span>
        <input
          type="search"
          value={query}
          placeholder="Search titles"
          disabled={busy}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="legacy-migration-list" aria-label="Legacy Marvel title preview">
        {filteredTitles.map((title) => {
          const year = releaseYear(title);
          return (
            <article key={title.id || title.identityKey}>
              <div>
                <strong>{title.title || title.baseTitle || "Untitled"}</strong>
                <span>{legacyTypeLabel(title)}{year ? ` · ${year}` : ""}</span>
              </div>
              <span className={title.isWatched ? "is-watched" : ""}>
                {title.isWatched ? "Watched" : "Unwatched"}
              </span>
            </article>
          );
        })}
        {!filteredTitles.length && <p>No titles match this search.</p>}
      </div>

      {busy && (
        <p className="legacy-migration-stage" aria-live="polite">
          <LoaderCircle aria-hidden="true" />
          {stageLabels[migration.stage] || "Preparing migration…"}
        </p>
      )}
      {migration.error && (
        <p className="legacy-migration-error" role="alert">{migration.error.message}</p>
      )}

      <div className="legacy-migration-actions">
        <button className="secondary-button" type="button" disabled={busy} onClick={onDismiss}>
          Not Now
        </button>
        <button className="primary-button" type="button" disabled={busy} onClick={onMigrate}>
          {busy && <LoaderCircle aria-hidden="true" />}
          {migration.error ? "Retry Migration" : `Migrate ${migration.summary.total} Titles`}
        </button>
      </div>
    </Modal>
  );
}

export function LegacyMarvelMigrationModal({ migration, onConfirm, onDismiss }) {
  const [pinError, setPinError] = useState(null);
  if (!["confirmation_required", "migrating"].includes(migration.status)) return null;

  async function migrate() {
    const pin = archiveService.askForPin();
    if (pin === null) return;
    if (!pin) {
      setPinError(new Error("A Seenetrica PIN is required to migrate."));
      return;
    }
    setPinError(null);
    try {
      await onConfirm(pin);
    } catch {
      // The provider keeps the modal open and exposes the categorized error.
    }
  }

  return (
    <LegacyMarvelMigrationDialog
      migration={{ ...migration, error: migration.error || pinError }}
      onMigrate={migrate}
      onDismiss={onDismiss}
    />
  );
}

export function LegacyMarvelMigrationReminder({ migration, onReview }) {
  if (migration.status !== "dismissed") return null;
  return (
    <aside className="legacy-migration-reminder" aria-live="polite">
      <span>Migration pending</span>
      <button type="button" onClick={onReview}>Review Migration</button>
    </aside>
  );
}
