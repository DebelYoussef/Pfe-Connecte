import { useEffect, useMemo, useState } from "react";
import { getUser } from "../../auth";
import { buildDocument } from "../../lib/conventionDocument";
import { verifyIntegrity } from "../../mock/conventionStore";
import Tooltip from "../ui/Tooltip";

const PARTY_LABELS = {
  STUDENT: "Étudiant",
  COMPANY: "Entreprise",
};
const SIGNATORY_ROLES = new Set(["ETU", "ENT", "RESP"]);

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function matchesHighlight(fieldSource, highlightParty) {
  if (!highlightParty) return false;
  return (
    fieldSource === highlightParty ||
    (highlightParty === "ETU" && fieldSource === "STUDENT") ||
    (highlightParty === "ENT" && fieldSource === "COMPANY")
  );
}

export default function ConventionDocument({
  convention,
  onRevealSensitive,
  highlightParty,
}) {
  const [revealedFields, setRevealedFields] = useState({});
  const [integrity, setIntegrity] = useState("checking");
  const document = useMemo(
    () => buildDocument(convention?.templateSnapshot, convention?.values),
    [convention?.templateSnapshot, convention?.values],
  );
  const canRevealSensitive = SIGNATORY_ROLES.has(getUser()?.role);
  const signatures = convention?.signatures || [];

  useEffect(() => {
    let active = true;
    setIntegrity("checking");
    verifyIntegrity(convention)
      .then((valid) => {
        if (active) setIntegrity(valid ? "verified" : "modified");
      })
      .catch(() => {
        if (active) setIntegrity("error");
      });
    return () => {
      active = false;
    };
  }, [convention]);

  function revealSensitive(field) {
    onRevealSensitive?.(field.key, field);
    setRevealedFields((current) => ({ ...current, [field.key]: true }));
  }

  return (
    <article className="paper-document">
      <header className="paper-document-header">
        {document.header.logoUrl && (
          <img
            className="paper-document-logo"
            src={document.header.logoUrl}
            alt=""
          />
        )}
        <div className="paper-document-header-lines">
          {(document.header.lines || []).map((line, index) => (
            <p dir="auto" key={`${index}-${line}`}>
              {line}
            </p>
          ))}
        </div>
      </header>

      <div className="paper-document-title">
        <h3>{document.title}</h3>
        <span>{convention?.shortRef || "—"}</span>
      </div>

      <div className="paper-document-sections">
        {document.sections.map((section) => (
          <section className="paper-document-section" key={section.id}>
            <h4>{section.title}</h4>
            <dl className="paper-document-fields">
              {section.fields.map((field) => {
                const missingRequired =
                  field.required && field.state === "missing";
                const highlighted = matchesHighlight(
                  field.source,
                  highlightParty,
                );
                const sourceLabel = PARTY_LABELS[field.source];
                let value = field.value || "";
                if (!value && missingRequired) {
                  const placeholder = (
                    <>
                      <span className="paper-missing-screen">À compléter</span>
                      <span className="paper-missing-print" aria-hidden="true" />
                    </>
                  );
                  value = sourceLabel ? (
                    <Tooltip content={`À compléter par : ${sourceLabel}.`}>
                      <span
                        className={`paper-missing paper-missing-${field.source.toLowerCase()}${highlighted ? " is-highlighted" : ""}`}
                        tabIndex={0}
                      >
                        {placeholder}
                      </span>
                    </Tooltip>
                  ) : (
                    <span className="paper-missing">
                      <span className="paper-missing-screen">À compléter</span>
                      <span className="paper-missing-print" aria-hidden="true" />
                    </span>
                  );
                } else if (field.sensitive && value) {
                  value = (
                    <span className="paper-sensitive-value">
                      <span>
                        {revealedFields[field.key] && canRevealSensitive
                          ? field.value
                          : "••••"}
                      </span>
                      {canRevealSensitive && (
                        <button
                          className="paper-reveal-button"
                          type="button"
                          aria-expanded={Boolean(revealedFields[field.key])}
                          onClick={() => revealSensitive(field)}
                        >
                          {revealedFields[field.key] ? "Masquer" : "Afficher"}
                        </button>
                      )}
                    </span>
                  );
                } else if (!value) {
                  value = "—";
                }

                return (
                  <div
                    className={[
                      "paper-document-field",
                      highlighted ? "is-highlighted" : "",
                      field.state === "locked" ? "is-locked" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={field.key}
                  >
                    <dt>{field.label}</dt>
                    <dd>
                      <span className="paper-field-value">{value}</span>
                      {field.helpText && (
                        <small className="paper-field-help">{field.helpText}</small>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <section className="paper-document-articles" aria-label="Articles">
        <h4>Articles</h4>
        <div className="paper-document-article-grid">
          {document.articles.map((article) => (
            <section className="paper-document-article" key={article.id}>
              <h5>{article.title}</h5>
              <p>{article.text}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="paper-document-signatures" aria-label="Signatures">
        <table>
          <thead>
            <tr>
              {document.signatories.map((signatory) => (
                <th scope="col" key={signatory.role}>
                  {signatory.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {document.signatories.map((signatory) => {
                const signature = signatures.find(
                  (item) => item.role === signatory.role,
                );
                return (
                  <td key={signatory.role}>
                    {signature ? (
                      <>
                        <strong>Signé le {formatDate(signature.signedAt)}</strong>
                        <code>{signature.hash?.slice(0, 12) || "—"}</code>
                      </>
                    ) : (
                      <strong>En attente</strong>
                    )}
                    <small>{signatory.hint}</small>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="paper-document-footer">
        {Object.entries(document.footer || {}).map(([label, value]) => (
          <span key={label}>
            <strong>
              {label === "code"
                ? "Code"
                : label === "revision"
                  ? "Révision"
                  : "Édition"}
              :
            </strong>{" "}
            {value}
          </span>
        ))}
      </footer>

      <div className="paper-document-legend" aria-label="Légende">
        <span className="paper-legend-student">Champ à compléter par l’étudiant</span>
        <span className="paper-legend-company">Champ à compléter par l’entreprise</span>
      </div>

      <p className={`integrity-line ${integrity}`} role="status">
        {integrity === "verified"
          ? "Intégrité vérifiée"
          : integrity === "modified"
            ? "Le document a été modifié depuis la signature"
            : integrity === "error"
              ? "Vérification de l’intégrité indisponible."
              : "Vérification de l’intégrité…"}
      </p>
    </article>
  );
}
