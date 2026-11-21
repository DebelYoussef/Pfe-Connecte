import { ArrowLeft, Download, Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import CompletionMeters from "../../components/convention/CompletionMeters";
import ConventionDocument from "../../components/convention/ConventionDocument";
import ConventionTimeline from "../../components/convention/ConventionTimeline";
import ConventionTracker from "../../components/convention/ConventionTracker";
import SignDialog from "../../components/convention/SignDialog";
import VerificationCard from "../../components/convention/VerificationCard";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import Tooltip from "../../components/ui/Tooltip";
import {
  computeCompletion,
  computePartyProgress,
  validateField,
} from "../../lib/conventionDocument";
import { verifyIntegrity } from "../../mock/conventionStore";
import useUnsavedWarning from "../student/parts/useUnsavedWarning";
import {
  correctConvention,
  getConvention,
  getConventionPdfUrl,
  rejectConvention,
  resubmitConvention,
  RESPONSABLE_DATA_CHANGED_EVENT,
  signConvention,
} from "../../services.responsable";

const STATE_LABELS = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  SIGNED_STUDENT: "Signée par l’étudiant",
  SIGNED_COMPANY: "Signée par l’entreprise",
  APPROVED: "Approuvée",
};
const REJECTABLE_STATES = ["SUBMITTED", "SIGNED_STUDENT", "SIGNED_COMPANY"];

function staticValuesFrom(snapshot) {
  return Object.fromEntries(
    (snapshot?.sections || []).flatMap((section) =>
      (section.fields || [])
        .filter((field) => field.source === "STATIC")
        .map((field) => [field.key, String(field.value ?? "")]),
    ),
  );
}

function copyArticles(articles) {
  return (articles || []).map((article) => ({ ...article }));
}

function missingRequired(snapshot, values) {
  const missing = { student: [], company: [] };
  for (const section of snapshot?.sections || []) {
    for (const field of section.fields || []) {
      if (
        !field.required ||
        !["STUDENT", "COMPANY"].includes(field.source) ||
        String(values?.[field.key] ?? "").trim()
      ) {
        continue;
      }
      missing[field.source === "STUDENT" ? "student" : "company"].push(field.label);
    }
  }
  return missing;
}

function inputType(type) {
  if (type === "phone") return "tel";
  if (["date", "email", "number"].includes(type)) return type;
  return "text";
}

function errorTitle(error) {
  if (error?.status === 400) return "Informations invalides";
  if (error?.status === 403) return "Accès refusé";
  if (error?.status === 404) return "Convention introuvable";
  if (error?.code === "DOCUMENT_CHANGED") return "Document modifié";
  if (error?.status === 409) return "Action impossible";
  return "Impossible de charger la convention";
}

export default function ResponsableConventionDetail() {
  const { conventionId } = useParams();
  const [convention, setConvention] = useState(null);
  const [draftStaticValues, setDraftStaticValues] = useState({});
  const [draftArticles, setDraftArticles] = useState([]);
  const [staticErrors, setStaticErrors] = useState({});
  const [articleError, setArticleError] = useState("");
  const [correctionSaved, setCorrectionSaved] = useState(false);
  const [integrity, setIntegrity] = useState({
    conventionId: null,
    hash: null,
    valid: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorAction, setErrorAction] = useState("load");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [toast, setToast] = useState("");

  const applyConvention = useCallback((value) => {
    setConvention(value);
    setDraftStaticValues(staticValuesFrom(value.templateSnapshot));
    setDraftArticles(copyArticles(value.templateSnapshot?.articles));
    setStaticErrors({});
    setArticleError("");
    setCorrectionSaved(false);
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await getConvention(conventionId);
        applyConvention(result);
        setError(null);
      } catch (loadError) {
        setConvention(null);
        setError(loadError);
        setErrorAction("load");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [applyConvention, conventionId],
  );

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const snapshot = convention?.templateSnapshot;
  const staticFields = useMemo(
    () =>
      (snapshot?.sections || []).flatMap((section) =>
        (section.fields || []).filter((field) => field.source === "STATIC"),
      ),
    [snapshot],
  );
  const correctionDirty = Boolean(
    convention &&
      (staticFields.some(
        (field) =>
          String(draftStaticValues[field.key] ?? "") !==
          String(field.value ?? ""),
      ) ||
        JSON.stringify(draftArticles) !==
          JSON.stringify(snapshot?.articles || [])),
  );
  useUnsavedWarning(correctionDirty);

  useEffect(() => {
    if (!convention) return undefined;
    let active = true;
    const frozenHash = convention.frozenHash;
    if (!frozenHash) return undefined;
    verifyIntegrity(convention)
      .then((valid) => {
        if (active) {
          setIntegrity({
            conventionId: convention.conventionId,
            hash: frozenHash,
            valid,
          });
        }
      })
      .catch(() => {
        if (active) {
          setIntegrity({
            conventionId: convention.conventionId,
            hash: frozenHash,
            valid: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [convention]);

  const currentIntegrity =
    integrity.conventionId === convention?.conventionId &&
    integrity.hash === (convention?.frozenHash || null);
  const integrityValid = !convention?.frozenHash
    ? true
    : currentIntegrity
      ? integrity.valid
      : null;

  useEffect(() => {
    const refresh = () => {
      if (!correctionDirty) void load(true);
    };
    window.addEventListener(RESPONSABLE_DATA_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RESPONSABLE_DATA_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [correctionDirty, load]);

  const draftSnapshot = useMemo(() => {
    if (!snapshot) return null;
    return {
      ...snapshot,
      sections: snapshot.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.source === "STATIC"
            ? {
                ...field,
                value: draftStaticValues[field.key] ?? field.value ?? "",
              }
            : field,
        ),
      })),
      articles: draftArticles,
    };
  }, [draftArticles, draftStaticValues, snapshot]);
  const previewConvention = useMemo(() => {
    if (!convention || !correctionDirty) return convention;
    return {
      ...convention,
      templateSnapshot: draftSnapshot,
      documentHash: "",
      frozenHash: null,
    };
  }, [convention, correctionDirty, draftSnapshot]);

  const completion = useMemo(
    () => computeCompletion(snapshot, convention?.values),
    [convention?.values, snapshot],
  );
  const progress = useMemo(
    () => computePartyProgress(snapshot, convention?.values),
    [convention?.values, snapshot],
  );
  const missing = useMemo(
    () => missingRequired(snapshot, convention?.values),
    [convention?.values, snapshot],
  );
  const staticValidationErrors = useMemo(
    () =>
      Object.fromEntries(
        staticFields
          .map((field) => [
            field.key,
            validateField(field, draftStaticValues[field.key]),
          ])
          .filter(([, message]) => message),
      ),
    [draftStaticValues, staticFields],
  );
  const articleTitleErrors = useMemo(
    () =>
      Object.fromEntries(
        draftArticles
          .map((article) => [
            article.id,
            String(article.title ?? "").trim()
              ? ""
              : "Le titre de l’article est obligatoire.",
          ])
          .filter(([, message]) => message),
      ),
    [draftArticles],
  );
  const hasCorrectionErrors =
    Object.keys(staticValidationErrors).length > 0 ||
    Object.keys(articleTitleErrors).length > 0;
  const events = useMemo(() => {
    const sourceEvents = convention?.events || [];
    const restartIndex = sourceEvents.reduce(
      (lastIndex, event, index) =>
        ["MODIFIED", "REJECTED", "RESUBMITTED"].includes(event.type)
          ? index
          : lastIndex,
      -1,
    );
    return sourceEvents
      .map((event, index) => ({
        ...event,
        invalidated:
          event.invalidated ||
          (index < restartIndex && event.type === "SIGNED"),
      }))
      .sort(
        (left, right) =>
          new Date(left.timestamp).getTime() -
          new Date(right.timestamp).getTime(),
      );
  }, [convention?.events]);
  const trackerDone = [
    ["SIGNED_STUDENT", "SIGNED_COMPANY", "APPROVED"].includes(convention?.state),
    ["SIGNED_COMPANY", "APPROVED"].includes(convention?.state),
    convention?.state === "APPROVED",
    convention?.state === "APPROVED",
  ];
  const waitingFor = useMemo(() => {
    if (!convention || convention.state === "APPROVED") return undefined;
    if (convention.currentActorId === `RESP#${convention.etab}`) return "vous";
    if (convention.currentActorId === convention.studentId) return "l’étudiant";
    if (convention.currentActorId === convention.companyId) return "l’entreprise";
    return "le responsable";
  }, [convention]);
  const toSign =
    convention?.state === "SIGNED_COMPANY" &&
    convention.currentActorId === `RESP#${convention.etab}`;
  const canReject = REJECTABLE_STATES.includes(convention?.state);
  const correctionAllowed = convention?.state === "DRAFT";
  const resubmitEnabled =
    correctionAllowed && completion.complete && !correctionDirty && !busy;
  const resubmitTooltip = !correctionAllowed
    ? "Seule une convention en brouillon peut être renvoyée."
    : busy
      ? "Une action est en cours."
      : correctionDirty
        ? "Enregistrez d’abord la correction."
        : !completion.complete
          ? `Complétez les parties manquantes : ${[
              ...missing.student,
              ...missing.company,
            ]
              .slice(0, 3)
              .join(", ")}${missing.student.length + missing.company.length > 3 ? "…" : ""}`
            : "Le circuit de signatures recommencera par l’étudiant.";
  const signatureHashMatches = Boolean(
    convention?.frozenHash &&
      convention.documentHash === convention.frozenHash &&
      integrityValid === true,
  );
  const approvalDisabled =
    busy || !toSign || integrityValid !== true || !signatureHashMatches;
  const approvalTooltip = !toSign
    ? convention?.state === "DRAFT"
      ? "Renvoyez d’abord la convention pour signature."
      : waitingFor
        ? `En attente de : ${waitingFor}.`
        : "Cette convention ne peut pas être approuvée à cette étape."
    : busy
      ? "Une action est en cours."
      : integrityValid === null
        ? "Vérification de l’intégrité en cours."
        : !signatureHashMatches
          ? "Le document a été modifié depuis sa signature."
          : "L’intégrité est vérifiée. La convention peut être approuvée.";
  const modificationEvent = [...events]
    .reverse()
    .find((event) => event.type === "MODIFIED" && !event.invalidated);

  async function refreshAfterConflict(actionError) {
    setError(actionError);
    setErrorAction("load");
    if (actionError?.status === 409) {
      try {
        applyConvention(await getConvention(conventionId));
      } catch (refreshError) {
        setError(refreshError);
      }
    }
  }

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copié.`);
    } catch {
      setToast("Impossible de copier dans le presse-papiers.");
    }
  }

  function updateStaticValue(field, value) {
    setDraftStaticValues((current) => ({ ...current, [field.key]: value }));
    setStaticErrors((current) => {
      const next = { ...current };
      delete next[field.key];
      return next;
    });
    setCorrectionSaved(false);
  }

  function updateArticle(index, key, value) {
    setDraftArticles((current) =>
      current.map((article, articleIndex) =>
        articleIndex === index ? { ...article, [key]: value } : article,
      ),
    );
    setArticleError("");
    setCorrectionSaved(false);
  }

  async function confirmSign() {
    setBusy(true);
    setError(null);
    try {
      applyConvention(await signConvention(conventionId));
      setDialog(null);
      setToast("Convention approuvée.");
    } catch (actionError) {
      await refreshAfterConflict(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    setError(null);
    try {
      applyConvention(
        await rejectConvention(conventionId, { reason: rejectionReason }),
      );
      setDialog(null);
      setRejectionReason("");
      setToast("Convention refusée. Les signatures ont été annulées.");
    } catch (actionError) {
      await refreshAfterConflict(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection() {
    if (hasCorrectionErrors || !correctionDirty) return;
    setBusy(true);
    setError(null);
    const staticValues = Object.fromEntries(
      staticFields
        .filter(
          (field) =>
            String(draftStaticValues[field.key] ?? "") !==
            String(field.value ?? ""),
        )
        .map((field) => [field.key, draftStaticValues[field.key] ?? ""]),
    );
    try {
      const updated = await correctConvention(conventionId, {
        staticValues,
        articles: draftArticles,
      });
      applyConvention(updated);
      setCorrectionSaved(true);
      setToast(
        `Correction enregistrée · nouvelle empreinte ${updated.documentHash?.slice(0, 12) || "—"}.`,
      );
    } catch (actionError) {
      setStaticErrors(actionError?.details?.messages || {});
      if (actionError?.details?.fields?.includes("articles")) {
        setArticleError(actionError.message);
      }
      setError(actionError);
      setErrorAction("correct");
    } finally {
      setBusy(false);
    }
  }

  async function confirmResubmit() {
    setBusy(true);
    setError(null);
    try {
      applyConvention(await resubmitConvention(conventionId));
      setDialog(null);
      setToast("Convention renvoyée. Le circuit recommence par l’étudiant.");
    } catch (actionError) {
      await refreshAfterConflict(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    setError(null);
    try {
      const result = await getConventionPdfUrl(conventionId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError(downloadError);
      setErrorAction("download");
    }
  }

  function retryFailedAction() {
    if (errorAction === "correct") return saveCorrection();
    if (errorAction === "download") return downloadPdf();
    return load();
  }

  if (loading) {
    return (
      <section
        className="student-page responsable-convention-detail-page"
        aria-busy="true"
      >
        <Skeleton className="responsable-detail-skeleton" />
      </section>
    );
  }

  if (!convention) {
    return (
      <section className="student-page responsable-convention-detail-page">
        <PageHeader eyebrow="Espace responsable" title="Convention" />
        {error && (
          <ErrorBanner
            title={errorTitle(error)}
            message={error.message || "Cette convention n’est pas disponible."}
            onRetry={retryFailedAction}
          />
        )}
        <Link className="company-convention-back" to="/responsable/conventions">
          <ArrowLeft aria-hidden="true" size={16} />
          Toutes les conventions
        </Link>
      </section>
    );
  }

  return (
    <section className="student-page responsable-convention-detail-page">
      <Link className="company-convention-back" to="/responsable/conventions">
        <ArrowLeft aria-hidden="true" size={16} />
        Retour aux conventions
      </Link>
      <PageHeader
        eyebrow="Espace responsable"
        title={convention.shortRef || "Convention"}
        subtitle={`${convention.studentName} · ${convention.companyName}`}
        action={
          <StatusBadge
            status={convention.state}
            label={STATE_LABELS[convention.state] || convention.state}
          />
        }
      />
      {error && (
        <ErrorBanner
          title={errorTitle(error)}
          message={error.message || "Une erreur est survenue. Réessayez."}
          onRetry={retryFailedAction}
          onClose={() => setError(null)}
        />
      )}
      {convention.state === "DRAFT" && convention.rejectionReason ? (
        <div className="convention-rejected" role="alert">
          <strong>Convention refusée</strong>
          <span>{convention.rejectionReason}</span>
        </div>
      ) : convention.state === "DRAFT" && modificationEvent ? (
        <div className="convention-modified-banner" role="alert">
          Une partie a demandé une modification : les signatures ont été annulées.
        </div>
      ) : null}
      <ConventionTracker doneSteps={trackerDone} waitingFor={waitingFor} />
      <CompletionMeters
        studentProgress={progress.student}
        companyProgress={progress.company}
      />
      {convention.state === "DRAFT" && !completion.complete && (
        <div className="convention-state-banner" role="status">
          <span>
            {missing.student.length > 0 &&
              `L’étudiant doit compléter : ${missing.student.join(", ")}. `}
            {missing.company.length > 0 &&
              `L’entreprise doit compléter : ${missing.company.join(", ")}.`}
          </span>
        </div>
      )}

      <div className="convention-grid responsable-convention-detail-grid">
        <div className="convention-main-column">
          {correctionAllowed && (
            <section className="responsable-correction-form info-card">
              <div className="convention-section-heading">
                <div>
                  <h3>Corriger le texte de cette convention</h3>
                  <p>
                    Cette correction ne modifie que cette convention, pas le
                    modèle de l’établissement.
                  </p>
                </div>
                {correctionSaved && (
                  <span className="responsable-corrected-label">
                    Empreinte mise à jour
                  </span>
                )}
              </div>
              {staticFields.length ? (
                (snapshot?.sections || []).map((section) => {
                  const fields = (section.fields || []).filter(
                    (field) => field.source === "STATIC",
                  );
                  if (!fields.length) return null;
                  return (
                    <fieldset
                      className="responsable-static-fields"
                      key={section.id}
                    >
                      <legend>{section.title}</legend>
                      <div className="student-fields-grid">
                        {fields.map((field) => {
                          const message =
                            staticErrors[field.key] ||
                            staticValidationErrors[field.key];
                          const id = `static-${field.key}`;
                          return (
                            <label
                              className="convention-field"
                              htmlFor={id}
                              key={field.key}
                            >
                              <span className="convention-field-label">
                                {field.label}
                                {field.required && <b aria-hidden="true"> *</b>}
                              </span>
                              {field.type === "textarea" ? (
                                <textarea
                                  id={id}
                                  value={draftStaticValues[field.key] ?? ""}
                                  aria-invalid={Boolean(message)}
                                  onChange={(event) =>
                                    updateStaticValue(field, event.target.value)
                                  }
                                  rows={3}
                                />
                              ) : (
                                <input
                                  id={id}
                                  type={inputType(field.type)}
                                  value={draftStaticValues[field.key] ?? ""}
                                  aria-invalid={Boolean(message)}
                                  onChange={(event) =>
                                    updateStaticValue(field, event.target.value)
                                  }
                                />
                              )}
                              {message && (
                                <small className="field-error" role="alert">
                                  {message}
                                </small>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })
              ) : (
                <EmptyState
                  title="Aucun champ fixe"
                  message="Cette convention ne contient aucun champ statique à corriger."
                />
              )}
              <section className="responsable-article-editors">
                <div className="responsable-detail-heading">
                  <h4>Articles</h4>
                  <p>
                    Les articles engagent les parties : relisez-les avant
                    d’enregistrer.
                  </p>
                </div>
                {draftArticles.length ? (
                  draftArticles.map((article, index) => (
                    <fieldset
                      className="responsable-article-editor"
                      key={article.id}
                    >
                      <legend>{article.title || `Article ${index + 1}`}</legend>
                      <label className="convention-field">
                        <span className="convention-field-label">Titre</span>
                        <input
                          value={article.title ?? ""}
                          aria-invalid={Boolean(articleTitleErrors[article.id])}
                          onChange={(event) =>
                            updateArticle(index, "title", event.target.value)
                          }
                        />
                        {articleTitleErrors[article.id] && (
                            <small className="field-error" role="alert">
                              {articleTitleErrors[article.id]}
                            </small>
                          )}
                      </label>
                      <label className="convention-field">
                        <span className="convention-field-label">Texte</span>
                        <textarea
                          rows={5}
                          value={article.text ?? ""}
                          onChange={(event) =>
                            updateArticle(index, "text", event.target.value)
                          }
                        />
                      </label>
                    </fieldset>
                  ))
                ) : (
                  <EmptyState
                    title="Aucun article"
                    message="Cette convention ne contient aucun article."
                  />
                )}
                {articleError && (
                  <p className="field-error" role="alert">
                    {articleError}
                  </p>
                )}
              </section>
              <div className="responsable-correction-actions">
                <Tooltip
                  content={
                    busy
                      ? "Une action est en cours."
                      : hasCorrectionErrors
                        ? "Corrigez les erreurs signalées."
                        : !correctionDirty
                          ? "Aucune correction à enregistrer."
                          : "Enregistrer les modifications apportées à cette convention."
                  }
                >
                  <span
                    className="convention-disabled-action"
                    tabIndex={busy || hasCorrectionErrors || !correctionDirty ? 0 : undefined}
                  >
                    <button
                      className="submit-button"
                      type="button"
                      disabled={busy || hasCorrectionErrors || !correctionDirty}
                      onClick={() => void saveCorrection()}
                    >
                      {busy ? "Enregistrement…" : "Enregistrer la correction"}
                    </button>
                  </span>
                </Tooltip>
                {correctionSaved && (
                  <span className="responsable-correction-hash">
                    Nouvelle empreinte{" "}
                    <code>{convention.documentHash?.slice(0, 12) || "—"}</code>
                  </span>
                )}
              </div>
            </section>
          )}

          <section aria-label="Document de convention">
            <ConventionDocument convention={previewConvention} />
          </section>

          <div className="document-actions convention-action-bar">
            <Tooltip content={approvalTooltip}>
              <span
                className="convention-disabled-action"
                tabIndex={approvalDisabled ? 0 : undefined}
              >
                <button
                  type="button"
                  className="submit-button"
                  disabled={approvalDisabled}
                  onClick={() => setDialog("approve")}
                >
                  Signer et approuver
                </button>
              </span>
            </Tooltip>
            <Tooltip
              content={
                canReject
                  ? busy
                    ? "Une action est en cours."
                    : "Refuser la convention avec un motif obligatoire."
                  : "Cette convention ne peut pas être refusée à cette étape."
              }
            >
              <span
                className="convention-disabled-action"
                tabIndex={!canReject || busy ? 0 : undefined}
              >
                <button
                  type="button"
                  className="danger-outline-button"
                  disabled={!canReject || busy}
                  onClick={() => {
                    setRejectionReason("");
                    setDialog("reject");
                  }}
                >
                  Refuser la convention
                </button>
              </span>
            </Tooltip>
            {correctionAllowed && (
              <Tooltip content={resubmitTooltip}>
                <span
                  className="convention-disabled-action"
                  tabIndex={!resubmitEnabled ? 0 : undefined}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!resubmitEnabled}
                    onClick={() => setDialog("resubmit")}
                  >
                    Renvoyer pour signature
                  </button>
                </span>
              </Tooltip>
            )}
            <Tooltip
              content={
                busy
                  ? "Attendez la fin de l’action en cours."
                  : "Télécharger une copie PDF de la convention."
              }
            >
              <span
                className="convention-disabled-action"
                tabIndex={busy ? 0 : undefined}
              >
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void downloadPdf()}
                >
                  <Download aria-hidden="true" size={15} />
                  Télécharger le PDF
                </button>
              </span>
            </Tooltip>
            <button
              type="button"
              className="secondary-button"
              onClick={() => window.print()}
            >
              <Printer aria-hidden="true" size={15} />
              Imprimer
            </button>
          </div>
        </div>

        <aside className="convention-aside">
          <div className="info-card convention-history">
            <h3>Historique</h3>
            <ConventionTimeline
              events={events}
              showRejectionReason
              invalidatedLabel={
                convention.rejectionReason
                  ? "Signature annulée après refus"
                  : "Signature annulée après modification"
              }
            />
          </div>
          <VerificationCard convention={convention} onCopy={copyValue} />
        </aside>
      </div>

      {dialog === "approve" && (
        <SignDialog
          open
          fingerprint={convention.frozenHash?.slice(0, 12)}
          title="Signer et approuver"
          body="Votre signature approuve définitivement la convention."
          acknowledgementLabel="J’ai lu la convention et je l’approuve"
          confirmLabel={busy ? "Signature…" : "Signer et approuver"}
          showFingerprintBlock
          busy={busy}
          canConfirm={!approvalDisabled}
          confirmTooltip={approvalTooltip}
          onCancel={() => setDialog(null)}
          onConfirm={() => void confirmSign()}
        />
      )}
      {dialog === "reject" && (
        <ConfirmDialog
          open
          title="Refuser la convention"
          body="La convention repasse en brouillon et toutes les signatures sont annulées."
          confirmLabel={busy ? "Refus…" : "Refuser la convention"}
          confirmDisabled={
            !rejectionReason.trim() || rejectionReason.length > 1000 || busy
          }
          confirmTooltip="Saisissez un motif pour continuer."
          onCancel={() => setDialog(null)}
          onConfirm={() => void confirmReject()}
        >
          <label className="responsable-rejection-field">
            <span>Motif du refus</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={rejectionReason}
              aria-invalid={Boolean(error?.details?.fields?.includes("reason"))}
              onChange={(event) => setRejectionReason(event.target.value)}
            />
            {error?.details?.fields?.includes("reason") && (
              <small className="field-error" role="alert">
                {error.message}
              </small>
            )}
            <small>{rejectionReason.length} / 1000</small>
          </label>
        </ConfirmDialog>
      )}
      {dialog === "resubmit" && (
        <ConfirmDialog
          open
          title="Renvoyer pour signature"
          body="Le circuit de signatures recommence par l’étudiant."
          confirmLabel={busy ? "Renvoi…" : "Renvoyer pour signature"}
          confirmDisabled={!resubmitEnabled}
          confirmTooltip={resubmitTooltip}
          onCancel={() => setDialog(null)}
          onConfirm={() => void confirmResubmit()}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
