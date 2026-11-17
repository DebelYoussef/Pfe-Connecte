import { useEffect, useRef, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import useUnsavedWarning from "../student/parts/useUnsavedWarning";
import {
  getConventionTemplate,
  putConventionTemplate,
} from "../../services.responsable";

const PLACEHOLDERS = [
  "{{etab}}",
  "{{student}}",
  "{{company}}",
  "{{subject}}",
  "{{startDate}}",
  "{{endDate}}",
  "{{durationWeeks}}",
];
const REQUIRED = ["{{student}}", "{{company}}", "{{subject}}"];

function previewText(template) {
  const values = {
    "{{etab}}": "Institut A",
    "{{student}}": "Étudiant exemple",
    "{{company}}": "Entreprise exemple",
    "{{subject}}": "Application de suivi PFE",
    "{{startDate}}": "15/02/2027",
    "{{endDate}}": "30/06/2027",
    "{{durationWeeks}}": "20",
  };
  const parts = String(template).split(/(\{\{[a-zA-Z]+\}\})/g);
  return parts.map((part, index) => {
    if (values[part]) return <span key={`${part}-${index}`}>{values[part]}</span>;
    if (/^\{\{[a-zA-Z]+\}\}$/.test(part)) {
      return <mark className="responsable-unfilled-placeholder" key={`${part}-${index}`}>{part}</mark>;
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

export default function ResponsableTemplate() {
  const [template, setTemplate] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState("");
  const textareaRef = useRef(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getConventionTemplate();
      setTemplate(result);
      setText(result.text);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const unknownPlaceholders = [...new Set(
    [...text.matchAll(/\{\{([^{}]+)\}\}/g)]
      .map((match) => `{{${match[1]}}}`)
      .filter((value) => !PLACEHOLDERS.includes(value)),
  )];
  const missingRequired = REQUIRED.filter((value) => !text.includes(value));
  const dirty = Boolean(template && text !== template.text);
  const valid = Boolean(text.trim()) && unknownPlaceholders.length === 0;
  useUnsavedWarning(dirty);

  function insertPlaceholder(value) {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? start;
    const next = `${text.slice(0, start)}${value}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      element.setSelectionRange(start + value.length, start + value.length);
    });
  }

  function reset() {
    setText(template?.text || "");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await putConventionTemplate({ text });
      setTemplate(updated);
      setText(updated.text);
      setDialogOpen(false);
      setToast(`Version ${updated.version} enregistrée.`);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-page responsable-page">
      <PageHeader
        eyebrow="Espace responsable"
        title="Modèle de convention"
        subtitle="Modèle utilisé pour générer les conventions de votre établissement."
      />
      {template && (
        <div className="responsable-template-version">
          <span>Version {template.version}</span>
          <small>
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
              new Date(template.createdAt),
            )}
          </small>
        </div>
      )}
      {error && (
        <ErrorBanner
          title="Impossible d’enregistrer le modèle"
          message={error.message || "Une erreur est survenue."}
          onRetry={() => void load()}
        />
      )}
      {loading ? (
        <Skeleton className="responsable-detail-skeleton" />
      ) : template ? (
        <div className="responsable-template-layout">
          <section className="responsable-template-editor">
            <div className="responsable-detail-heading">
              <h3>Texte du modèle</h3>
              <small>{text.length} caractères</small>
            </div>
            <textarea
              ref={textareaRef}
              className="responsable-template-textarea"
              value={text}
              required
              onChange={(event) => setText(event.target.value)}
            />
            <div className="responsable-placeholder-palette" aria-label="Variables disponibles">
              {PLACEHOLDERS.map((placeholder) => (
                <button type="button" onClick={() => insertPlaceholder(placeholder)} key={placeholder}>
                  {placeholder}
                </button>
              ))}
            </div>
            {!text.trim() && (
              <p className="responsable-template-warning" role="alert">
                Le texte du modèle est requis.
              </p>
            )}
            {unknownPlaceholders.length > 0 && (
              <p className="responsable-template-warning" role="alert">
                {unknownPlaceholders.map((value) => `Variable inconnue : ${value}`).join(" · ")}
              </p>
            )}
            {missingRequired.length > 0 && (
              <p className="responsable-template-warning" role="status">
                Variable obligatoire manquante : {missingRequired.join(", ")}
              </p>
            )}
            <div className="responsable-template-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={!dirty}
                title={!dirty ? "Aucune modification à annuler" : "Annuler les modifications"}
                onClick={reset}
              >
                Annuler les modifications
              </button>
              <button
                type="button"
                className="hero-button"
                disabled={!dirty || !valid}
                title={
                  !dirty
                    ? "Aucune modification à enregistrer"
                    : !text.trim()
                      ? "Le texte du modèle est requis"
                      : unknownPlaceholders.length
                        ? "Retirez les variables inconnues"
                        : "Enregistrer une nouvelle version"
                }
                onClick={() => setDialogOpen(true)}
              >
                Enregistrer une nouvelle version
              </button>
            </div>
            <p className="responsable-template-history-note">
              Historique des versions — Non disponible pour le moment.
            </p>
          </section>
          <aside className="responsable-template-preview">
            <div className="responsable-detail-heading">
              <h3>Aperçu en direct</h3>
            </div>
            <article className="paper-document responsable-template-paper">
              <div className="paper-header">
                <strong>CONVENTION DE STAGE</strong>
                <span>PFE-2027-0001<br />Version {template.version + (dirty ? 1 : 0)}</span>
              </div>
              <h3>Convention de stage</h3>
              <p className="document-rendered-text">{previewText(text)}</p>
              <p>Les conditions du stage sont définies avec l’entreprise d’accueil et l’établissement universitaire.</p>
            </article>
          </aside>
        </div>
      ) : null}
      {dialogOpen && (
        <ConfirmDialog
          open
          title={`Créer la version ${template.version + 1} ?`}
          body="Une nouvelle version sera créée. Les conventions déjà créées conservent leur version."
          confirmLabel={saving ? "Enregistrement…" : `Créer la version ${template.version + 1}`}
          confirmDisabled={saving}
          onCancel={() => setDialogOpen(false)}
          onConfirm={() => void save()}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
