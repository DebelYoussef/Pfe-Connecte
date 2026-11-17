import { CheckCircle2, Copy, XCircle } from "lucide-react";

export default function ConventionDocument({
  convention,
  integrityVerified,
  integrityHash,
  onCopy,
}) {
  return (
    <article className="paper-document">
      <div className="paper-header">
        <strong>CONVENTION DE STAGE</strong>
        <span>
          {convention.shortRef}
          <br />
          Version {convention.templateVersion}
        </span>
      </div>
      <h3>Convention de stage</h3>
      <p className="document-rendered-text">{convention.renderedText}</p>
      <p>
        La durée et les conditions du stage sont définies avec l’entreprise
        d’accueil et l’établissement universitaire.
      </p>
      <div className="document-fingerprint">
        <div>
          <strong>Empreinte du document</strong>
          <code>{convention.pdfSha256?.slice(0, 12) || "—"}</code>
        </div>
        <button
          type="button"
          aria-label="Copier l’empreinte du document"
          onClick={() => onCopy(convention.pdfSha256, "Empreinte")}
        >
          <Copy aria-hidden="true" size={14} />
          Copier
        </button>
      </div>
      <p
        className={integrityVerified ? "integrity-line verified" : "integrity-line"}
        role="status"
      >
        {integrityVerified ? (
          <CheckCircle2 aria-hidden="true" size={16} />
        ) : (
          <XCircle aria-hidden="true" size={16} />
        )}
        {integrityVerified
          ? "Intégrité vérifiée"
          : integrityHash
            ? "Intégrité non vérifiée"
            : "Vérification de l’intégrité…"}
      </p>
    </article>
  );
}
