import { ArrowLeft, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import ConventionDocument from "../../components/convention/ConventionDocument";
import ConventionTimeline from "../../components/convention/ConventionTimeline";
import ConventionTracker from "../../components/convention/ConventionTracker";
import VerificationCard from "../../components/convention/VerificationCard";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import Tooltip from "../../components/ui/Tooltip";
import useUnsavedWarning from "../student/parts/useUnsavedWarning";
import { getUser } from "../../auth";
import { getConventionTextHash } from "../../services";
import {
  correctConvention,
  getConvention,
  getConventionPdfUrl,
  rejectConvention,
  resubmitConvention,
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

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(date);
}

function errorTitle(error) {
  if (error?.status === 403) return "Accès refusé";
  if (error?.status === 404) return "Convention introuvable";
  if (error?.status === 409) return "Action impossible";
  return "Impossible de charger la convention";
}

export default function ResponsableConventionDetail() {
  const { conventionId } = useParams();
  const [convention, setConvention] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [integrityHash, setIntegrityHash] = useState("");
  const [toast, setToast] = useState("");
  const [correctionSaved, setCorrectionSaved] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getConvention(conventionId);
      setConvention(result);
      setText(result.renderedText || "");
      setCorrectionSaved(false);
    } catch (loadError) {
      setConvention(null);
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [conventionId]);

  useEffect(() => {
    if (!convention?.renderedText) return undefined;
    let active = true;
    getConventionTextHash(convention.renderedText)
      .then((hash) => active && setIntegrityHash(hash))
      .catch(() => active && setIntegrityHash(""));
    return () => { active = false; };
  }, [convention?.renderedText]);

  const dirty = Boolean(convention?.state === "DRAFT" && text !== convention.renderedText);
  useUnsavedWarning(dirty);

  const events = useMemo(
    () => [...(convention?.events || [])].sort(
      (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    ),
    [convention],
  );
  const trackerDone = useMemo(() => [
    ["SIGNED_STUDENT", "SIGNED_COMPANY", "APPROVED"].includes(convention?.state),
    ["SIGNED_COMPANY", "APPROVED"].includes(convention?.state),
    convention?.state === "APPROVED",
    convention?.state === "APPROVED",
  ], [convention?.state]);
  const waitingFor = useMemo(() => {
    if (!convention || convention.state === "APPROVED") return undefined;
    if (convention.currentActorId === `RESP#${getUser()?.etab}`) return "Vous";
    if (String(convention.currentActorId || "").startsWith("student-")) return "Étudiant";
    if (String(convention.currentActorId || "").startsWith("company-")) return "Entreprise";
    return "Responsable";
  }, [convention]);
  const toSign =
    convention?.state === "SIGNED_COMPANY" &&
    convention.currentActorId === `RESP#${getUser()?.etab}`;
  const canReject = REJECTABLE_STATES.includes(convention?.state);
  const integrityVerified = Boolean(
    integrityHash && integrityHash === convention?.pdfSha256,
  );
  const modificationEvent = [...events]
    .reverse()
    .find((eventItem) => eventItem.type === "MODIFIED" && !eventItem.invalidated);

  async function refreshAfterConflict(actionError) {
    setError(actionError);
    if (actionError?.status === 409) {
      try {
        const refreshed = await getConvention(conventionId);
        setConvention(refreshed);
        setText(refreshed.renderedText || "");
      } catch (refreshError) {
        setError(refreshError);
      }
    }
  }

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copié`);
    } catch {
      setToast("Impossible de copier dans le presse-papiers.");
    }
  }

  async function confirmSign() {
    setBusy(true);
    setError(null);
    try {
      const updated = await signConvention(conventionId);
      setConvention(updated);
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
      const updated = await rejectConvention(conventionId, { reason: rejectionReason });
      setConvention(updated);
      setText(updated.renderedText || "");
      setDialog(null);
      setRejectionReason("");
      setCorrectionSaved(false);
      setToast("Convention refusée. Les signatures ont été annulées.");
    } catch (actionError) {
      await refreshAfterConflict(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await correctConvention(conventionId, { renderedText: text });
      setConvention(updated);
      setText(updated.renderedText || "");
      setCorrectionSaved(true);
      setToast("Empreinte mise à jour.");
    } catch (actionError) {
      await refreshAfterConflict(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function confirmResubmit() {
    setBusy(true);
    setError(null);
    try {
      const updated = await resubmitConvention(conventionId);
      setConvention(updated);
      setText(updated.renderedText || "");
      setDialog(null);
      setCorrectionSaved(false);
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
    }
  }

  if (loading) {
    return (
      <section className="student-page responsable-convention-detail-page">
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
            onRetry={() => void load()}
          />
        )}
        <Link className="company-convention-back" to="/responsable/conventions">
          <ArrowLeft aria-hidden="true" size={16} />
          Toutes les conventions
        </Link>
      </section>
    );
  }

  const institutionName =
    getUser()?.etab === "ETAB2" ? "Institut B" : "Institut A";
  const resubmitEnabled =
    convention.state === "DRAFT" && (!dirty || correctionSaved);

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
          onRetry={() => void load()}
        />
      )}
      {convention.state === "DRAFT" && convention.rejectionReason ? (
        <div className="convention-modified-banner" role="alert">
          <span>
            <strong>Convention refusée</strong>
            <br />
            {convention.rejectionReason}
          </span>
        </div>
      ) : convention.state === "DRAFT" && modificationEvent ? (
        <div className="convention-modified-banner" role="alert">
          L’étudiant a modifié ses informations : les signatures ont été annulées.
        </div>
      ) : null}
      <ConventionTracker doneSteps={trackerDone} waitingFor={waitingFor} />
      <div className="convention-grid responsable-convention-detail-grid">
        <div className="convention-main-column">
          {convention.state === "DRAFT" ? (
            <section className="responsable-edit-document">
              <div className="responsable-detail-heading">
                <h3>Corriger le texte</h3>
                {correctionSaved && <span className="responsable-corrected-label">Empreinte mise à jour</span>}
              </div>
              <textarea
                className="responsable-textarea"
                value={text}
                maxLength={10000}
                required
                onChange={(event) => {
                  setText(event.target.value);
                  setCorrectionSaved(false);
                }}
              />
              <button
                type="button"
                className="hero-button"
                disabled={busy || !text.trim() || !dirty}
                title={!dirty ? "Aucune modification à enregistrer" : !text.trim() ? "Le texte est requis" : "Enregistrer les corrections"}
                onClick={() => void saveCorrection()}
              >
                {busy ? "Enregistrement…" : "Enregistrer la correction"}
              </button>
            </section>
          ) : (
            <ConventionDocument
              convention={convention}
              integrityVerified={integrityVerified}
              integrityHash={integrityHash}
              onCopy={copyValue}
            />
          )}
          <div className="document-actions convention-action-bar">
            {toSign ? (
              <button
                type="button"
                className="submit-button"
                disabled={busy}
                onClick={() => setDialog("sign")}
              >
                Signer et approuver
              </button>
            ) : (
              <Tooltip
                content={
                  waitingFor
                    ? `En attente de : ${waitingFor}.`
                    : "Cette convention ne peut pas être approuvée à cette étape."
                }
              >
                <span className="convention-disabled-action" tabIndex={0}>
                  <button type="button" className="submit-button" disabled>
                    Signer et approuver
                  </button>
                </span>
              </Tooltip>
            )}
            {canReject ? (
              <button
                type="button"
                className="danger-outline-button"
                disabled={busy}
                onClick={() => {
                  setRejectionReason("");
                  setDialog("reject");
                }}
              >
                Refuser la convention
              </button>
            ) : (
              <Tooltip content="Cette convention ne peut pas être refusée à cette étape.">
                <span className="convention-disabled-action" tabIndex={0}>
                  <button type="button" className="danger-outline-button" disabled>
                    Refuser la convention
                  </button>
                </span>
              </Tooltip>
            )}
            {convention.state === "DRAFT" ? (
              <Tooltip
                content={
                  resubmitEnabled
                    ? "Renvoyer le circuit de signatures"
                    : "Enregistrez d’abord les modifications"
                }
              >
                <span className="convention-disabled-action" tabIndex={0}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!resubmitEnabled || busy}
                    onClick={() => setDialog("resubmit")}
                  >
                    Renvoyer pour signature
                  </button>
                </span>
              </Tooltip>
            ) : null}
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void downloadPdf()}
            >
              <Download aria-hidden="true" size={15} />
              Télécharger le PDF
            </button>
          </div>
        </div>
        <aside className="convention-aside">
          <div className="info-card responsable-information-card">
            <h3>Informations</h3>
            <p><strong>Étudiant</strong>{convention.studentName}</p>
            <p><strong>Entreprise</strong>{convention.companyName}</p>
            <p><strong>Offre</strong>{convention.offerTitle || convention.subjectTitle}</p>
            <p><strong>Institution</strong>{institutionName}</p>
            <p><strong>Créée le</strong>{formatDate(convention.createdAt)}</p>
            <p><strong>Adresse de l’étudiant</strong>{/* NOT IN API YET */}{convention.studentAddress || "—"}</p>
            <p><strong>Téléphone de l’étudiant</strong>{/* NOT IN API YET */}{convention.studentPhone || "—"}</p>
          </div>
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
      {dialog === "sign" && (
        <ConfirmDialog
          open
          title="Signer et approuver"
          body="Votre signature approuve définitivement la convention."
          confirmLabel={busy ? "Signature…" : "Signer et approuver"}
          confirmDisabled={busy}
          confirmTooltip="La signature est en cours."
          acknowledgementLabel="J’ai lu la convention et je l’approuve"
          onCancel={() => setDialog(null)}
          onConfirm={() => void confirmSign()}
        >
          <div className="responsable-sign-fingerprint">
            <strong>Empreinte du document</strong>
            <code>{convention.pdfSha256?.slice(0, 12) || "—"}</code>
          </div>
        </ConfirmDialog>
      )}
      {dialog === "reject" && (
        <ConfirmDialog
          open
          title="Refuser la convention"
          body="La convention repasse en brouillon et toutes les signatures sont annulées."
          confirmLabel={busy ? "Refus…" : "Refuser la convention"}
          confirmDisabled={!rejectionReason.trim() || rejectionReason.length > 1000 || busy}
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
              onChange={(event) => setRejectionReason(event.target.value)}
            />
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
          confirmDisabled={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => void confirmResubmit()}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
