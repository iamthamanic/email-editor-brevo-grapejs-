/**
 * Banner + action for outdated Brevo-backed editor schema.
 * Location: apps/editor/src/templates/MigrationBanner.tsx
 */

type Props = {
  busy: boolean;
  error: string | null;
  onMigrate: () => void;
};

export function MigrationBanner({ busy, error, onMigrate }: Props) {
  return (
    <div
      className="ed-banner ed-banner-migration"
      role="status"
      aria-live="polite"
    >
      <div className="ed-banner-migration-body">
        <p>
          Die Vorlage stammt aus einer älteren Editor-Version. Abschnitte oder
          das Layout können unvollständig sein.
        </p>
        <p className="ed-banner-migration-hint">
          Aktualisieren lädt die Originalvorlage erneut aus Brevo und ersetzt
          die lokale Editor-Struktur. Es wird nichts automatisch an Brevo
          gesendet.
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="ed-btn-primary"
        disabled={busy}
        onClick={onMigrate}
      >
        {busy ? "Wird aktualisiert…" : "Jetzt aktualisieren"}
      </button>
    </div>
  );
}
