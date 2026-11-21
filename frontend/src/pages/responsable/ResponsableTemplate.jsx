import {
  ArrowDown,
  ArrowUp,
  Copy,
  FileImage,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import ConventionDocument from "../../components/convention/ConventionDocument";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import IconButton from "../../components/ui/IconButton";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import Tooltip from "../../components/ui/Tooltip";
import { AUTO_BINDINGS, etabName, resolveAuto } from "../../lib/conventionDocument";
import useUnsavedWarning from "../student/parts/useUnsavedWarning";
import {
  getDefaultStructuredConventionTemplate,
  getStructuredConventionTemplate,
  putStructuredConventionTemplate,
} from "../../services.responsable";

const FIELD_TYPES = [
  ["text", "Texte"],
  ["email", "E-mail"],
  ["phone", "Téléphone"],
  ["date", "Date"],
  ["textarea", "Zone de texte"],
  ["number", "Nombre"],
];
const SOURCES = [
  ["STATIC", "Fixe"],
  ["AUTO", "Automatique"],
  ["STUDENT", "Étudiant"],
  ["COMPANY", "Entreprise"],
];
const SIGNATORY_DEFAULTS = [
  {
    role: "ETU",
    label: "L'élève stagiaire",
    hint: "Nom, prénom et signature obligatoires",
  },
  {
    role: "ENT",
    label: "Le représentant de l'établissement d'accueil",
    hint: "Cachet et signature obligatoires",
  },
  {
    role: "RESP",
    label: "Le Directeur de l'établissement",
    hint: "Cachet et signature obligatoires",
  },
];
// NOT IN API YET: these sample values are only used by the local builder preview.
const PREVIEW_CONTEXT = {
  student: {
    fullName: "Étudiant Exemple",
    firstName: "Étudiant",
    lastName: "Exemple",
    email: "etudiant@example.test",
    specialty: "Informatique",
    department: "Informatique",
    gouvernorat: "Tunis",
  },
  institution: { name: "Institut A" },
  company: {
    name: "Entreprise exemple",
    contactName: "Contact entreprise",
    email: "contact@entreprise-exemple.test",
  },
  offer: {
    title: "Application de suivi des stages",
    durationWeeks: 16,
    gouvernorat: "Tunis",
    workMode: "Hybride",
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTemplate(template) {
  return {
    ...template,
    header: {
      ...(template.header || {}),
      lines: Array.isArray(template.header?.lines)
        ? [...template.header.lines]
        : [],
    },
    sections: Array.isArray(template.sections)
      ? template.sections.map((section) => ({
          ...section,
          fields: Array.isArray(section.fields) ? section.fields.map((field) => ({ ...field })) : [],
        }))
      : [],
    articles: Array.isArray(template.articles)
      ? template.articles.map((article) => ({ ...article }))
      : [],
    signatories: SIGNATORY_DEFAULTS.map((fallback) => ({
      ...fallback,
      ...(template.signatories || []).find((item) => item.role === fallback.role),
    })),
    footer: {
      code: "",
      revision: "",
      edition: "",
      ...template.footer,
    },
  };
}

function editableTemplate(template) {
  if (!template) return null;
  const content = clone(template);
  delete content.version;
  delete content.createdAt;
  return content;
}

function keyFromLabel(label) {
  const normalized = String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || "champ";
}

function uniqueKey(label, fields, excludedKey) {
  const taken = new Set(
    fields.filter((field) => field.key !== excludedKey).map((field) => field.key),
  );
  const base = keyFromLabel(label);
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function allFields(template) {
  return (template?.sections || []).flatMap((section) => section.fields || []);
}

function moveItem(items, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function validationErrors(template) {
  if (!template) return [];
  const errors = [];
  const fields = (template.sections || []).flatMap((section, sectionIndex) =>
    (section.fields || []).map((field, fieldIndex) => ({
      field,
      path: `field:${sectionIndex}:${fieldIndex}`,
    })),
  );
  const counts = new Map();
  for (const { field } of fields) {
    counts.set(field.key, (counts.get(field.key) || 0) + 1);
  }

  let hasStudent = false;
  let hasCompany = false;
  for (const { field, path } of fields) {
    if (!/^[A-Za-z0-9_]+$/.test(String(field.key || ""))) {
      errors.push({ path: `${path}:key`, message: "Utilisez uniquement des lettres, chiffres et traits de soulignement." });
    }
    if (counts.get(field.key) > 1) {
      errors.push({ path: `${path}:key`, message: "Cette clé est déjà utilisée." });
    }
    if (!String(field.label || "").trim()) {
      errors.push({ path: `${path}:label`, message: "Le libellé est obligatoire." });
    }
    if (!FIELD_TYPES.some(([type]) => type === field.type)) {
      errors.push({ path: `${path}:type`, message: "Sélectionnez un type valide." });
    }
    if (!SOURCES.some(([source]) => source === field.source)) {
      errors.push({ path: `${path}:source`, message: "Sélectionnez une source valide." });
    }
    if (typeof field.required !== "boolean") {
      errors.push({ path: `${path}:required`, message: "Indiquez si le champ est obligatoire." });
    }
    if (field.source === "STATIC" && !String(field.value || "").trim()) {
      errors.push({ path: `${path}:value`, message: "Une valeur est requise pour un champ fixe." });
    }
    if (field.source === "AUTO" && !Object.hasOwn(AUTO_BINDINGS, field.binding)) {
      errors.push({ path: `${path}:binding`, message: "Sélectionnez une donnée automatique." });
    }
    if (field.source === "STUDENT") hasStudent = true;
    if (field.source === "COMPANY") hasCompany = true;
  }

  if (!hasStudent) {
    errors.push({
      path: "template:student",
      message: "Ajoutez au moins un champ Étudiant.",
    });
  }
  if (!hasCompany) {
    errors.push({
      path: "template:company",
      message: "Ajoutez au moins un champ Entreprise.",
    });
  }
  (template.articles || []).forEach((article, index) => {
    if (!String(article.title || "").trim()) {
      errors.push({
        path: `article:${index}:title`,
        message: "Le titre de l'article est obligatoire.",
      });
    }
  });
  return errors;
}

function sampleValue(field) {
  if (field.type === "email") return "contact@exemple.test";
  if (field.type === "phone") return "+216 20 123 456";
  if (field.type === "date") return "2026-03-15";
  if (field.type === "number") return "16";
  if (field.type === "textarea") return "Exemple de contenu à compléter pour le stage.";
  if (field.key === "studentNationality") return "Tunisienne";
  if (field.key === "companyCountry") return "Tunisie";
  if (String(field.key || "").toLowerCase().includes("postal")) return "1000";
  if (field.key === "studentBirthDatePlace") return "1er janvier 2000, Tunis";
  return `Exemple de ${String(field.label || "valeur").toLocaleLowerCase("fr")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function inputType(type) {
  if (type === "email") return "email";
  if (type === "phone") return "tel";
  if (type === "date") return "date";
  if (type === "number") return "number";
  return "text";
}

function FieldError({ messages }) {
  if (!messages?.length) return null;
  return (
    <div className="template-builder-validation" role="alert">
      {messages.map((message) => <span key={message}>{message}</span>)}
    </div>
  );
}

function Switch({ checked, label, description, onChange }) {
  return (
    <div className="template-builder-switch-row">
      <div>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </div>
      <button
        type="button"
        className="template-builder-switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export default function ResponsableTemplate() {
  const [template, setTemplate] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [assetError, setAssetError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [toast, setToast] = useState("");
  const [expandedField, setExpandedField] = useState(null);
  const [previewAs, setPreviewAs] = useState("ALL");
  const logoInputRef = useRef(null);
  const idPrefix = `template-${useId().replace(/:/g, "")}`;

  const fetchTemplate = useCallback(() => getStructuredConventionTemplate(), []);
  const applyTemplate = useCallback((value) => {
    const normalized = normalizeTemplate(value);
    setTemplate(normalized);
    setDraft(clone(normalized));
  }, []);

  useEffect(() => {
    let active = true;
    fetchTemplate()
      .then((value) => {
        if (active) applyTemplate(value);
      })
      .catch((loadError) => {
        if (active) setError(loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyTemplate, fetchTemplate]);

  const errors = useMemo(() => validationErrors(draft), [draft]);
  const errorsByPath = useMemo(() => {
    const result = new Map();
    for (const item of errors) {
      result.set(item.path, [...(result.get(item.path) || []), item.message]);
    }
    return result;
  }, [errors]);
  const dirty = Boolean(
    template &&
    draft &&
    JSON.stringify(editableTemplate(template)) !== JSON.stringify(editableTemplate(draft)),
  );
  const valid = errors.length === 0;
  useUnsavedWarning(dirty);

  const previewConvention = useMemo(() => {
    if (!draft) return null;
    const context = {
      ...PREVIEW_CONTEXT,
      institution: { name: etabName(draft.etab) },
    };
    const values = {};
    for (const field of allFields(draft)) {
      if (field.source === "AUTO") {
        values[field.key] = resolveAuto(field.binding, context);
      } else if (field.source === "STUDENT" || field.source === "COMPANY") {
        values[field.key] = sampleValue(field);
      }
    }
    return {
      templateSnapshot: draft,
      values,
      shortRef: "APERÇU",
      signatures: [],
    };
  }, [draft]);

  const saveDisabledReason = !dirty
    ? "Aucune modification à enregistrer."
    : !valid
      ? `Corrigez les ${errors.length} erreur${errors.length > 1 ? "s" : ""} avant d'enregistrer.`
      : saving
        ? "Enregistrement en cours."
        : "";
  const cancelDisabledReason = dirty ? "" : "Aucune modification à annuler.";

  function updateDraft(change) {
    setDraft((current) => current && change(current));
  }

  function updateHeader(field, value) {
    updateDraft((current) => ({
      ...current,
      header: { ...current.header, [field]: value },
    }));
  }

  function updateSection(sectionIndex, change) {
    updateDraft((current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex ? change(section) : section,
      ),
    }));
  }

  function updateField(sectionIndex, fieldIndex, property, value) {
    updateDraft((current) => {
      const currentField = current.sections[sectionIndex]?.fields[fieldIndex];
      if (!currentField) return current;
      const fields = allFields(current);
      let nextValue = value;
      if (
        property === "label" &&
        currentField.key === keyFromLabel(currentField.label)
      ) {
        nextValue = uniqueKey(value, fields, currentField.key);
      }
      return {
        ...current,
        sections: current.sections.map((section, index) =>
          index === sectionIndex
            ? {
                ...section,
                fields: section.fields.map((field, itemIndex) =>
                  itemIndex === fieldIndex
                    ? {
                        ...field,
                        [property]: property === "required" || property === "sensitive"
                          ? value
                          : nextValue,
                      }
                    : field,
                ),
              }
            : section,
        ),
      };
    });
  }

  function addHeaderLine() {
    updateHeader("lines", [...(draft?.header.lines || []), ""]);
  }

  function updateHeaderLine(index, value) {
    updateHeader(
      "lines",
      draft.header.lines.map((line, lineIndex) => lineIndex === index ? value : line),
    );
  }

  function moveHeaderLine(index, direction) {
    updateHeader("lines", moveItem(draft.header.lines, index, direction));
  }

  function removeHeaderLine(index) {
    updateHeader(
      "lines",
      draft.header.lines.filter((_, lineIndex) => lineIndex !== index),
    );
  }

  function addSection() {
    const id = `section-${Date.now()}`;
    updateDraft((current) => ({
      ...current,
      sections: [...current.sections, { id, title: "Nouvelle section", fields: [] }],
    }));
  }

  function moveSection(index, direction) {
    updateDraft((current) => ({
      ...current,
      sections: moveItem(current.sections, index, direction),
    }));
  }

  function addField(sectionIndex) {
    const label = "Nouveau champ";
    const key = uniqueKey(label, allFields(draft));
    updateSection(sectionIndex, (section) => ({
      ...section,
      fields: [
        ...section.fields,
        { key, label, type: "text", source: "STUDENT", required: true },
      ],
    }));
    setExpandedField(`${sectionIndex}-${draft.sections[sectionIndex].fields.length}`);
  }

  function duplicateField(sectionIndex, fieldIndex) {
    const field = draft.sections[sectionIndex].fields[fieldIndex];
    const label = `${field.label} (copie)`;
    const copy = {
      ...field,
      key: uniqueKey(label, allFields(draft)),
      label,
    };
    updateSection(sectionIndex, (section) => ({
      ...section,
      fields: [
        ...section.fields.slice(0, fieldIndex + 1),
        copy,
        ...section.fields.slice(fieldIndex + 1),
      ],
    }));
    setExpandedField(`${sectionIndex}-${fieldIndex + 1}`);
  }

  function moveField(sectionIndex, fieldIndex, direction) {
    updateSection(sectionIndex, (section) => ({
      ...section,
      fields: moveItem(section.fields, fieldIndex, direction),
    }));
  }

  function addArticle() {
    const id = `article-${Date.now()}`;
    updateDraft((current) => ({
      ...current,
      articles: [
        ...current.articles,
        { id, title: "Nouvel article", text: "" },
      ],
    }));
  }

  function updateArticle(index, property, value) {
    updateDraft((current) => ({
      ...current,
      articles: current.articles.map((article, articleIndex) =>
        articleIndex === index ? { ...article, [property]: value } : article,
      ),
    }));
  }

  function moveArticle(index, direction) {
    updateDraft((current) => ({
      ...current,
      articles: moveItem(current.articles, index, direction),
    }));
  }

  function updateSignatory(role, property, value) {
    updateDraft((current) => ({
      ...current,
      signatories: current.signatories.map((signatory) =>
        signatory.role === role
          ? { ...signatory, [property]: value }
          : signatory,
      ),
    }));
  }

  function updateFooter(property, value) {
    updateDraft((current) => ({
      ...current,
      footer: { ...current.footer, [property]: value },
    }));
  }

  function handleLogoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isImage = ["image/jpeg", "image/png"].includes(file.type) ||
      /\.(jpe?g|png)$/i.test(file.name);
    if (!isImage) {
      setAssetError("Choisissez une image JPG ou PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAssetError("Le logo ne doit pas dépasser 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setAssetError("Impossible de lire ce fichier.");
        return;
      }
      setAssetError("");
      updateHeader("logoUrl", reader.result);
    };
    reader.onerror = () => setAssetError("Impossible de lire ce fichier.");
    // NOT IN API YET: store the logo as a data URL in the local convention template.
    reader.readAsDataURL(file);
  }

  const retryLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyTemplate(await fetchTemplate());
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [applyTemplate, fetchTemplate]);

  async function saveTemplate() {
    setSaving(true);
    setError(null);
    try {
      const updated = await putStructuredConventionTemplate({
        ...draft,
        etab: template.etab,
      });
      applyTemplate(updated);
      setConfirmation(null);
      setToast(`Version ${updated.version} enregistrée.`);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefault() {
    try {
      const restored = await getDefaultStructuredConventionTemplate();
      setDraft(normalizeTemplate(restored));
      setExpandedField(null);
      setAssetError("");
      setConfirmation(null);
      setToast("Modèle par défaut chargé. Enregistrez-le pour publier la nouvelle version.");
    } catch (restoreError) {
      setError(restoreError);
      setConfirmation(null);
    }
  }

  function confirmDelete() {
    if (confirmation?.type === "section") {
      updateDraft((current) => ({
        ...current,
        sections: current.sections.filter((section) => section.id !== confirmation.id),
      }));
    } else if (confirmation?.type === "field") {
      updateSection(confirmation.sectionIndex, (section) => ({
        ...section,
        fields: section.fields.filter((_, index) => index !== confirmation.fieldIndex),
      }));
    } else if (confirmation?.type === "article") {
      updateDraft((current) => ({
        ...current,
        articles: current.articles.filter((_, index) => index !== confirmation.index),
      }));
    }
    setConfirmation(null);
  }

  async function confirmAction() {
    if (confirmation?.type === "save") return saveTemplate();
    if (confirmation?.type === "restore") return restoreDefault();
    confirmDelete();
  }

  const confirmationDetails = useMemo(() => {
    if (!confirmation || !template) return null;
    if (confirmation.type === "save") {
      const nextVersion = template.version + 1;
      return {
        title: `Enregistrer la version ${nextVersion} ?`,
        body: `Une nouvelle version ${nextVersion} sera créée. Les conventions déjà créées conservent leur version.`,
        confirmLabel: saving ? "Enregistrement…" : "Enregistrer la nouvelle version",
      };
    }
    if (confirmation.type === "restore") {
      return {
        title: "Restaurer le modèle par défaut ?",
        body: "Le modèle actuel sera remplacé dans l’éditeur. Enregistrez une nouvelle version pour publier cette restauration.",
        confirmLabel: "Restaurer le modèle",
      };
    }
    return {
      title: "Supprimer cet élément ?",
      body: "Cette suppression ne sera publiée qu’après l’enregistrement d’une nouvelle version.",
      confirmLabel: "Supprimer",
    };
  }, [confirmation, saving, template]);

  if (loading) {
    return (
      <section className="student-page responsable-page">
        <PageHeader
          eyebrow="Espace responsable"
          title="Modèle de convention"
          subtitle="Définissez le formulaire de convention de votre établissement : champs fixes, champs à remplir par l'étudiant ou par l'entreprise, et articles."
        />
        <div className="template-builder-loading" aria-busy="true">
          <Skeleton className="template-builder-loading-card" />
          <Skeleton className="template-builder-loading-card" />
        </div>
      </section>
    );
  }

  return (
    <section className="student-page responsable-page template-builder-page">
      <PageHeader
        eyebrow="Espace responsable"
        title="Modèle de convention"
        subtitle="Définissez le formulaire de convention de votre établissement : champs fixes, champs à remplir par l'étudiant ou par l'entreprise, et articles."
      />
      {error && (
        <ErrorBanner
          title="Impossible de charger ou d’enregistrer le modèle"
          message={error.message || "Une erreur est survenue. Réessayez."}
          onRetry={() => void retryLoad()}
        />
      )}
      {!draft ? (
        <EmptyState
          title="Modèle indisponible"
          message="Réessayez de charger le modèle de convention."
          actionLabel="Réessayer"
          actionTo="/responsable/modele"
        />
      ) : (
        <>
          <div className="template-builder-meta">
            <div className="template-builder-version">
              <span className="template-builder-version-chip">Version {template.version}</span>
              <small>Créée le {formatDate(template.createdAt)}</small>
            </div>
            <p className="template-builder-history-note">
              {/* NOT IN API YET: the template service has no version-history endpoint. */}
              L’historique des versions n’est pas encore disponible.
            </p>
            <button
              type="button"
              className="secondary-button template-builder-restore"
              onClick={() => setConfirmation({ type: "restore" })}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Restaurer le modèle par défaut
            </button>
          </div>

          <div className="template-builder-layout">
            <div className="template-builder-editor">
              <section className="template-builder-card">
                <div className="template-builder-card-heading">
                  <div>
                    <h3>En-tête et titre</h3>
                    <p>Personnalisez le titre et les lignes d’en-tête du document.</p>
                  </div>
                </div>
                <label className="template-builder-label" htmlFor={`${idPrefix}-title`}>
                  Titre du document
                </label>
                <input
                  id={`${idPrefix}-title`}
                  className="template-builder-input"
                  value={draft.title || ""}
                  onChange={(event) =>
                    updateDraft((current) => ({ ...current, title: event.target.value }))
                  }
                />

                <div className="template-builder-subheading">
                  <h4>Lignes d’en-tête</h4>
                  <button
                    type="button"
                    className="template-builder-small-action"
                    onClick={addHeaderLine}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Ajouter une ligne
                  </button>
                </div>
                {draft.header.lines.length ? (
                  <div className="template-builder-line-list">
                    {draft.header.lines.map((line, index) => (
                      <div className="template-builder-line-row" key={`header-${index}`}>
                        <input
                          className="template-builder-input"
                          aria-label={`Ligne d’en-tête ${index + 1}`}
                          dir="auto"
                          value={line}
                          onChange={(event) => updateHeaderLine(index, event.target.value)}
                        />
                        <div className="template-builder-icon-actions">
                          <IconButton
                            label="Déplacer la ligne vers le haut"
                            tooltip={index === 0 ? "Déjà en première position" : "Déplacer vers le haut"}
                            disabled={index === 0}
                            onClick={() => moveHeaderLine(index, -1)}
                          >
                            <ArrowUp size={15} aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label="Déplacer la ligne vers le bas"
                            tooltip={index === draft.header.lines.length - 1 ? "Déjà en dernière position" : "Déplacer vers le bas"}
                            disabled={index === draft.header.lines.length - 1}
                            onClick={() => moveHeaderLine(index, 1)}
                          >
                            <ArrowDown size={15} aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label="Supprimer la ligne d’en-tête"
                            tooltip="Supprimer la ligne"
                            onClick={() => removeHeaderLine(index)}
                          >
                            <X size={15} aria-hidden="true" />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="template-builder-empty">Aucune ligne d’en-tête. Ajoutez-en une pour l’afficher dans le document.</p>
                )}

                <div className="template-builder-logo">
                  <div>
                    <strong>Logo de l’établissement</strong>
                    <small>JPG ou PNG, 2 Mo maximum. L’image est stockée localement.</small>
                  </div>
                  <input
                    ref={logoInputRef}
                    className="template-builder-file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    aria-label="Choisir le logo de l’établissement"
                    onChange={handleLogoFile}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload size={15} aria-hidden="true" />
                    Choisir une image
                  </button>
                  {draft.header.logoUrl && (
                    <div className="template-builder-logo-preview">
                      <img src={draft.header.logoUrl} alt="Aperçu du logo" />
                      <IconButton
                        label="Supprimer le logo"
                        tooltip="Supprimer le logo"
                        onClick={() => updateHeader("logoUrl", "")}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </IconButton>
                    </div>
                  )}
                  {assetError && <p className="template-builder-validation" role="alert">{assetError}</p>}
                </div>
              </section>

              <section className="template-builder-card">
                <div className="template-builder-card-heading">
                  <div>
                    <h3>Sections et champs</h3>
                    <p>Organisez les informations fixes, automatiques et à compléter par chaque partie.</p>
                  </div>
                  <button
                    type="button"
                    className="template-builder-small-action"
                    onClick={addSection}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Ajouter une section
                  </button>
                </div>
                {draft.sections.length ? (
                  <div className="template-builder-sections">
                    {draft.sections.map((section, sectionIndex) => (
                      <section className="template-builder-section" key={section.id}>
                        <div className="template-builder-section-heading">
                          <label className="template-builder-section-title">
                            <span>Section {sectionIndex + 1}</span>
                            <input
                              className="template-builder-input"
                              aria-label={`Titre de la section ${sectionIndex + 1}`}
                              value={section.title || ""}
                              onChange={(event) =>
                                updateSection(sectionIndex, (current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <div className="template-builder-icon-actions">
                            <IconButton
                              label="Déplacer la section vers le haut"
                              tooltip={sectionIndex === 0 ? "Déjà en première position" : "Déplacer vers le haut"}
                              disabled={sectionIndex === 0}
                              onClick={() => moveSection(sectionIndex, -1)}
                            >
                              <ArrowUp size={15} aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label="Déplacer la section vers le bas"
                              tooltip={sectionIndex === draft.sections.length - 1 ? "Déjà en dernière position" : "Déplacer vers le bas"}
                              disabled={sectionIndex === draft.sections.length - 1}
                              onClick={() => moveSection(sectionIndex, 1)}
                            >
                              <ArrowDown size={15} aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label={`Supprimer la section ${section.title || sectionIndex + 1}`}
                              tooltip="Supprimer la section"
                              onClick={() => setConfirmation({ type: "section", id: section.id })}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </IconButton>
                          </div>
                        </div>

                        {section.fields.length ? (
                          <div className="template-builder-fields">
                            {section.fields.map((field, fieldIndex) => {
                              const rowId = `${sectionIndex}-${fieldIndex}`;
                              const expanded = expandedField === rowId;
                              const fieldPath = `field:${sectionIndex}:${fieldIndex}`;
                              return (
                                <div className="template-builder-field" key={`${section.id}-${field.key}-${fieldIndex}`}>
                                  <div className="template-builder-field-row">
                                    <button
                                      type="button"
                                      className="template-builder-field-toggle"
                                      aria-expanded={expanded}
                                      onClick={() => setExpandedField(expanded ? null : rowId)}
                                    >
                                      <span className="template-builder-field-name">{field.label || "Champ sans libellé"}</span>
                                      <span className="template-builder-field-type">{FIELD_TYPES.find(([value]) => value === field.type)?.[1] || field.type}</span>
                                      <span className={`template-builder-source-pill source-${String(field.source || "").toLowerCase()}`}>
                                        {SOURCES.find(([value]) => value === field.source)?.[1] || "Source invalide"}
                                      </span>
                                      {field.required && <span className="template-builder-required">Obligatoire</span>}
                                      {field.sensitive && <span className="template-builder-sensitive">Sensible</span>}
                                    </button>
                                    <div className="template-builder-icon-actions">
                                      <IconButton
                                        label="Déplacer le champ vers le haut"
                                        tooltip={fieldIndex === 0 ? "Déjà en première position" : "Déplacer vers le haut"}
                                        disabled={fieldIndex === 0}
                                        onClick={() => moveField(sectionIndex, fieldIndex, -1)}
                                      >
                                        <ArrowUp size={14} aria-hidden="true" />
                                      </IconButton>
                                      <IconButton
                                        label="Déplacer le champ vers le bas"
                                        tooltip={fieldIndex === section.fields.length - 1 ? "Déjà en dernière position" : "Déplacer vers le bas"}
                                        disabled={fieldIndex === section.fields.length - 1}
                                        onClick={() => moveField(sectionIndex, fieldIndex, 1)}
                                      >
                                        <ArrowDown size={14} aria-hidden="true" />
                                      </IconButton>
                                      <IconButton
                                        label="Dupliquer le champ"
                                        tooltip="Dupliquer le champ"
                                        onClick={() => duplicateField(sectionIndex, fieldIndex)}
                                      >
                                        <Copy size={14} aria-hidden="true" />
                                      </IconButton>
                                      <IconButton
                                        label="Supprimer le champ"
                                        tooltip="Supprimer le champ"
                                        onClick={() => setConfirmation({
                                          type: "field",
                                          sectionIndex,
                                          fieldIndex,
                                        })}
                                      >
                                        <Trash2 size={14} aria-hidden="true" />
                                      </IconButton>
                                    </div>
                                  </div>
                                  {expanded && (
                                    <div className="template-builder-field-editor">
                                      <div className="template-builder-form-grid">
                                        <div>
                                          <label className="template-builder-label" htmlFor={`${idPrefix}-label-${rowId}`}>Libellé</label>
                                          <input
                                            id={`${idPrefix}-label-${rowId}`}
                                            className="template-builder-input"
                                            value={field.label || ""}
                                            aria-invalid={Boolean(errorsByPath.get(`${fieldPath}:label`))}
                                            onChange={(event) => updateField(sectionIndex, fieldIndex, "label", event.target.value)}
                                          />
                                          <FieldError messages={errorsByPath.get(`${fieldPath}:label`)} />
                                        </div>
                                        <div>
                                          <label className="template-builder-label" htmlFor={`${idPrefix}-key-${rowId}`}>Clé unique</label>
                                          <input
                                            id={`${idPrefix}-key-${rowId}`}
                                            className="template-builder-input template-builder-code-input"
                                            value={field.key || ""}
                                            aria-invalid={Boolean(errorsByPath.get(`${fieldPath}:key`))}
                                            onChange={(event) => updateField(sectionIndex, fieldIndex, "key", event.target.value)}
                                          />
                                          <FieldError messages={errorsByPath.get(`${fieldPath}:key`)} />
                                        </div>
                                        <div>
                                          <label className="template-builder-label" htmlFor={`${idPrefix}-type-${rowId}`}>Type</label>
                                          <select
                                            id={`${idPrefix}-type-${rowId}`}
                                            className="template-builder-input"
                                            value={field.type}
                                            onChange={(event) => updateField(sectionIndex, fieldIndex, "type", event.target.value)}
                                          >
                                            {FIELD_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                                          </select>
                                          <FieldError messages={errorsByPath.get(`${fieldPath}:type`)} />
                                        </div>
                                      </div>

                                      <fieldset className="template-builder-source-control">
                                        <legend>Source du champ</legend>
                                        <div className="template-builder-segmented">
                                          {SOURCES.map(([value, label]) => (
                                            <button
                                              type="button"
                                              key={value}
                                              aria-pressed={field.source === value}
                                              className={field.source === value ? "active" : ""}
                                              onClick={() => updateField(sectionIndex, fieldIndex, "source", value)}
                                            >
                                              {label}
                                            </button>
                                          ))}
                                        </div>
                                        <FieldError messages={errorsByPath.get(`${fieldPath}:source`)} />
                                      </fieldset>

                                      {field.source === "STATIC" && (
                                        <div>
                                          <label className="template-builder-label" htmlFor={`${idPrefix}-value-${rowId}`}>Valeur</label>
                                          {field.type === "textarea" ? (
                                            <textarea
                                              id={`${idPrefix}-value-${rowId}`}
                                              className="template-builder-input template-builder-textarea"
                                              value={field.value || ""}
                                              onChange={(event) => updateField(sectionIndex, fieldIndex, "value", event.target.value)}
                                            />
                                          ) : (
                                            <input
                                              id={`${idPrefix}-value-${rowId}`}
                                              className="template-builder-input"
                                              type={inputType(field.type)}
                                              value={field.value || ""}
                                              aria-invalid={Boolean(errorsByPath.get(`${fieldPath}:value`))}
                                              onChange={(event) => updateField(sectionIndex, fieldIndex, "value", event.target.value)}
                                            />
                                          )}
                                          <FieldError messages={errorsByPath.get(`${fieldPath}:value`)} />
                                        </div>
                                      )}
                                      {field.source === "AUTO" && (
                                        <div>
                                          <label className="template-builder-label" htmlFor={`${idPrefix}-binding-${rowId}`}>Donnée automatique</label>
                                          <select
                                            id={`${idPrefix}-binding-${rowId}`}
                                            className="template-builder-input"
                                            value={field.binding || ""}
                                            aria-invalid={Boolean(errorsByPath.get(`${fieldPath}:binding`))}
                                            onChange={(event) => updateField(sectionIndex, fieldIndex, "binding", event.target.value)}
                                          >
                                            <option value="">Choisir une donnée</option>
                                            {Object.entries(AUTO_BINDINGS).map(([binding, label]) => (
                                              <option value={binding} key={binding}>{label}</option>
                                            ))}
                                          </select>
                                          <FieldError messages={errorsByPath.get(`${fieldPath}:binding`)} />
                                        </div>
                                      )}

                                      <div className="template-builder-switches">
                                        <Switch
                                          label="Obligatoire"
                                          checked={Boolean(field.required)}
                                          onChange={(value) => updateField(sectionIndex, fieldIndex, "required", value)}
                                        />
                                        <FieldError messages={errorsByPath.get(`${fieldPath}:required`)} />
                                        <Switch
                                          label="Donnée sensible"
                                          description="Masquée par défaut, jamais affichée sur la page de vérification."
                                          checked={Boolean(field.sensitive)}
                                          onChange={(value) => updateField(sectionIndex, fieldIndex, "sensitive", value)}
                                        />
                                      </div>
                                      <div className="template-builder-form-grid">
                                        <div>
                                          <label className="template-builder-label" htmlFor={`${idPrefix}-placeholder-${rowId}`}>Texte indicatif</label>
                                          <input
                                            id={`${idPrefix}-placeholder-${rowId}`}
                                            className="template-builder-input"
                                            value={field.placeholder || ""}
                                            onChange={(event) => updateField(sectionIndex, fieldIndex, "placeholder", event.target.value)}
                                          />
                                        </div>
                                        <div>
                                          <label className="template-builder-label" htmlFor={`${idPrefix}-help-${rowId}`}>Texte d’aide</label>
                                          <input
                                            id={`${idPrefix}-help-${rowId}`}
                                            className="template-builder-input"
                                            value={field.helpText || ""}
                                            onChange={(event) => updateField(sectionIndex, fieldIndex, "helpText", event.target.value)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="template-builder-empty">
                            <h4>Aucun champ dans cette section</h4>
                            <p>Ajoutez un champ pour compléter cette section.</p>
                          </div>
                        )}
                        <button
                          type="button"
                          className="template-builder-add-field"
                          onClick={() => addField(sectionIndex)}
                        >
                          <Plus size={14} aria-hidden="true" />
                          Ajouter un champ
                        </button>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="template-builder-empty">
                    <h4>Aucune section</h4>
                    <p>Ajoutez une section pour commencer la structure du formulaire.</p>
                  </div>
                )}
                {errorsByPath.get("template:student") && <FieldError messages={errorsByPath.get("template:student")} />}
                {errorsByPath.get("template:company") && <FieldError messages={errorsByPath.get("template:company")} />}
              </section>

              <section className="template-builder-card">
                <div className="template-builder-card-heading">
                  <div>
                    <h3>Articles</h3>
                    <p>Le texte juridique est repris dans chaque convention créée avec cette version.</p>
                  </div>
                  <button
                    type="button"
                    className="template-builder-small-action"
                    onClick={addArticle}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Ajouter un article
                  </button>
                </div>
                <p className="template-builder-legal-warning">
                  Ces articles engagent les parties : relisez-les avant de publier.
                </p>
                {draft.articles.length ? (
                  <div className="template-builder-articles">
                    {draft.articles.map((article, index) => (
                      <section className="template-builder-article" key={`${article.id}-${index}`}>
                        <div className="template-builder-article-heading">
                          <span>Article {index + 1}</span>
                          <div className="template-builder-icon-actions">
                            <IconButton
                              label="Déplacer l’article vers le haut"
                              tooltip={index === 0 ? "Déjà en première position" : "Déplacer vers le haut"}
                              disabled={index === 0}
                              onClick={() => moveArticle(index, -1)}
                            >
                              <ArrowUp size={15} aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label="Déplacer l’article vers le bas"
                              tooltip={index === draft.articles.length - 1 ? "Déjà en dernière position" : "Déplacer vers le bas"}
                              disabled={index === draft.articles.length - 1}
                              onClick={() => moveArticle(index, 1)}
                            >
                              <ArrowDown size={15} aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label="Supprimer l’article"
                              tooltip="Supprimer l’article"
                              onClick={() => setConfirmation({ type: "article", index })}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </IconButton>
                          </div>
                        </div>
                        <label className="template-builder-label" htmlFor={`${idPrefix}-article-title-${index}`}>Titre</label>
                        <input
                          id={`${idPrefix}-article-title-${index}`}
                          className="template-builder-input"
                          value={article.title || ""}
                          aria-invalid={Boolean(errorsByPath.get(`article:${index}:title`))}
                          onChange={(event) => updateArticle(index, "title", event.target.value)}
                        />
                        <FieldError messages={errorsByPath.get(`article:${index}:title`)} />
                        <label className="template-builder-label" htmlFor={`${idPrefix}-article-text-${index}`}>Texte</label>
                        <textarea
                          id={`${idPrefix}-article-text-${index}`}
                          className="template-builder-input template-builder-textarea template-builder-article-text"
                          value={article.text || ""}
                          onChange={(event) => updateArticle(index, "text", event.target.value)}
                        />
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="template-builder-empty">
                    <h4>Aucun article</h4>
                    <p>Ajoutez les articles qui encadrent le stage.</p>
                  </div>
                )}
              </section>

              <section className="template-builder-card">
                <div className="template-builder-card-heading">
                  <div>
                    <h3>Signatures et pied de page</h3>
                    <p>Les rôles de signature restent fixes; leurs libellés et indications sont modifiables.</p>
                  </div>
                </div>
                <div className="template-builder-signatories">
                  {draft.signatories.map((signatory, index) => (
                    <fieldset className="template-builder-signatory" key={signatory.role}>
                      <legend>{["Étudiant", "Entreprise", "Responsable"][index]}</legend>
                      <label className="template-builder-label" htmlFor={`${idPrefix}-sign-label-${signatory.role}`}>Libellé</label>
                      <input
                        id={`${idPrefix}-sign-label-${signatory.role}`}
                        className="template-builder-input"
                        value={signatory.label || ""}
                        onChange={(event) => updateSignatory(signatory.role, "label", event.target.value)}
                      />
                      <label className="template-builder-label" htmlFor={`${idPrefix}-sign-hint-${signatory.role}`}>Indication</label>
                      <input
                        id={`${idPrefix}-sign-hint-${signatory.role}`}
                        className="template-builder-input"
                        value={signatory.hint || ""}
                        onChange={(event) => updateSignatory(signatory.role, "hint", event.target.value)}
                      />
                    </fieldset>
                  ))}
                </div>
                <div className="template-builder-form-grid template-builder-footer-fields">
                  {[
                    ["code", "Code"],
                    ["revision", "Révision"],
                    ["edition", "Édition"],
                  ].map(([property, label]) => (
                    <div key={property}>
                      <label className="template-builder-label" htmlFor={`${idPrefix}-footer-${property}`}>{label}</label>
                      <input
                        id={`${idPrefix}-footer-${property}`}
                        className="template-builder-input"
                        value={draft.footer[property] || ""}
                        onChange={(event) => updateFooter(property, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <div className="template-builder-sticky-bar">
                <div className={errors.length ? "template-builder-error-count has-errors" : "template-builder-error-count"}>
                  {errors.length
                    ? `${errors.length} erreur${errors.length > 1 ? "s" : ""} à corriger`
                    : "Modèle valide"}
                </div>
                <div className="template-builder-sticky-actions">
                  <Tooltip content={cancelDisabledReason || "Annuler les modifications"}>
                    <span>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!dirty || saving}
                        onClick={() => {
                          setDraft(clone(template));
                          setAssetError("");
                          setExpandedField(null);
                        }}
                      >
                        Annuler les modifications
                      </button>
                    </span>
                  </Tooltip>
                  <Tooltip content={saveDisabledReason || "Enregistrer une nouvelle version"}>
                    <span>
                      <button
                        type="button"
                        className="submit-button"
                        disabled={!dirty || !valid || saving}
                        onClick={() => setConfirmation({ type: "save" })}
                      >
                        Enregistrer une nouvelle version
                      </button>
                    </span>
                  </Tooltip>
                </div>
              </div>
            </div>

            <aside className="template-builder-preview">
              <div className="template-builder-preview-heading">
                <div>
                  <h3>Aperçu en direct</h3>
                  <small>Version {template.version + (dirty ? 1 : 0)}</small>
                </div>
                <FileImage size={18} aria-hidden="true" />
              </div>
              <fieldset className="template-builder-preview-toggle">
                <legend>Voir comme</legend>
                <div className="template-builder-segmented">
                  {[
                    ["ALL", "Document complet"],
                    ["STUDENT", "Étudiant"],
                    ["COMPANY", "Entreprise"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={previewAs === value}
                      className={previewAs === value ? "active" : ""}
                      onClick={() => setPreviewAs(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {previewConvention && (
                <ConventionDocument
                  convention={previewConvention}
                  highlightParty={previewAs === "ALL" ? undefined : previewAs}
                />
              )}
              <div className="template-builder-preview-note">
                <span className="template-builder-source-pill source-student">Étudiant</span>
                <span className="template-builder-source-pill source-company">Entreprise</span>
                <span>Les couleurs indiquent les champs à compléter par chaque partie.</span>
              </div>
            </aside>
          </div>
          {!valid && (
            <p className="template-builder-sr-only" role="status">
              Le modèle contient {errors.length} erreur{errors.length > 1 ? "s" : ""}.
            </p>
          )}
        </>
      )}

      {confirmation && confirmationDetails && (
        <ConfirmDialog
          open
          title={confirmationDetails.title}
          body={confirmationDetails.body}
          confirmLabel={confirmationDetails.confirmLabel}
          confirmDisabled={saving}
          confirmTooltip={saving ? "Enregistrement en cours" : undefined}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmAction()}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
