import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
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
import { getUser } from "../../auth";
import {
  getConvention,
  getConventionPdfUrl,
  rejectConvention,
  signConvention,
} from "../../services.company";
import { getConventionTextHash } from "../../services";

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
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
}

function waitLabel(convention) {
  if (convention.state === "APPROVED") return undefined;
  if (
    convention.state === "SIGNED_STUDENT" &&
    convention.currentActorId === getUser()?.userId
  )
    return "Vous";
  if (String(convention.currentActorId || "").startsWith("RESP#"))
    return "Responsable";
  if (convention.state === "SIGNED_COMPANY") return "Responsable";
  if (convention.state === "SIGNED_STUDENT") return "Entreprise";
  return "Étudiant";
}

function errorTitle(error) {
  if (error?.status === 403) return "Accès refusé";
  if (error?.status === 404) return "Convention introuvable";
  if (error?.status === 409) return "Action impossible";
  return "Impossible de charger la convention";
}

function ConventionDetailSkeleton() {
  return (
    <section className="company-convention-detail-skeleton" aria-busy="true">
      <Skeleton className="company-convention-detail-heading" />
      <Skeleton className="company-convention-detail-tracker" />
      <div>
        <Skeleton className="company-convention-detail-document" />
        <Skeleton className="company-convention-detail-aside" />
      </div>
    </section>
  );
}

export default function CompanyConvention() {
  const { conventionId } = useParams();
  const [convention, setConvention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [signatureAcknowledged, setSignatureAcknowledged] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [integrityHash, setIntegrityHash] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = "Convention · PFE Connect";
  }, []);

  useEffect(() => {
    let active = true;
    getConvention(conventionId)
      .then((result) => {
        if (!active) return;
        setConvention(result);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setConvention(null);
        setError(loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conventionId, retry]);

  function retryLoad() {
    setLoading(true);
    setRetry((value) => value + 1);
  }

  useEffect(() => {
    if (!convention?.renderedText || !convention.pdfSha256) return undefined;
    let active = true;
    getConventionTextHash(convention.renderedText)
      .then((hash) => active && setIntegrityHash(hash))
      .catch(() => active && setIntegrityHash(""));
    return () => {
      active = false;
    };
  }, [convention?.renderedText, convention?.pdfSha256]);

  const events = useMemo(
    () =>
      [...(convention?.events || [])].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [convention],
  );
  const trackerDone = useMemo(
    () => [
      ["SIGNED_STUDENT", "SIGNED_COMPANY", "APPROVED"].includes(
        convention?.state,
      ),
      ["SIGNED_COMPANY", "APPROVED"].includes(convention?.state),
      convention?.state === "APPROVED",
      convention?.state === "APPROVED",
    ],
    [convention?.state],
  );
  const companyId = getUser()?.userId;
  const canSign =
    convention?.state === "SIGNED_STUDENT" &&
    convention.currentActorId === companyId;
  const canReject = REJECTABLE_STATES.includes(convention?.state);
  const integrityVerified = Boolean(
    integrityHash && integrityHash === convention?.pdfSha256,
  );
  const modificationEvent = [...events]
    .reverse()
    .find((event) => event.type === "MODIFIED" && !event.invalidated);

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copié`);
    } catch {
      setToast("Impossible de copier dans le presse-papiers.");
    }
  }

  async function refreshAfterConflict(actionError) {
    setError(actionError);
    if (actionError?.status !== 409) return;
    try {
      setConvention(await getConvention(conventionId));
    } catch (refreshError) {
      setError(refreshError);
    }
  }

  async function confirmSign() {
    setBusy(true);
    setError(null);
    try {
      const updated = await signConvention(conventionId);
      setConvention(updated);
      setDialog(null);
      setSignatureAcknowledged(false);
      setToast("Convention signée électroniquement.");
    } catch (signError) {
      await refreshAfterConflict(signError);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    setError(null);
    try {
      const updated = await rejectConvention(conventionId, {
        reason: rejectionReason,
      });
      setConvention(updated);
      setDialog(null);
      setRejectionReason("");
      setToast("Convention refusée. Les signatures ont été annulées.");
    } catch (rejectError) {
      await refreshAfterConflict(rejectError);
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

  if (
    loading ||
    (convention && convention.conventionId !== conventionId)
  )
    return <ConventionDetailSkeleton />;

  if (!convention) {
    return (
      <section className="company-convention-detail-page">
        <PageHeader eyebrow="Espace entreprise" title="Convention" />
        {error && (
          <ErrorBanner
            title={errorTitle(error)}
            message={error.message || "Cette convention n’est pas disponible."}
            onRetry={retryLoad}
          />
        )}
        <Link className="company-convention-back" to="/company/conventions">
          <ArrowLeft aria-hidden="true" size={16} />
          Toutes les conventions
        </Link>
      </section>
    );
  }

  return (
    <section className="company-convention-detail-page">
      <Link className="company-convention-back" to="/company/conventions">
        <ArrowLeft aria-hidden="true" size={16} />
        Toutes les conventions
      </Link>
      <PageHeader
        eyebrow="Espace entreprise"
        title="Convention de stage"
        subtitle={`${convention.studentName} · ${convention.offerTitle}`}
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
          onRetry={retryLoad}
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
          En attente de renvoi par le responsable.
        </div>
      ) : null}
      <ConventionTracker
        doneSteps={trackerDone}
        waitingFor={waitLabel(convention)}
      />
      <div className="convention-grid company-convention-detail-grid">
        <div className="convention-main-column">
          <ConventionDocument
            convention={convention}
            integrityVerified={integrityVerified}
            integrityHash={integrityHash}
            onCopy={copyValue}
          />
          <div className="document-actions convention-action-bar">
            {canSign ? (
              <button
                className="submit-button"
                type="button"
                disabled={busy}
                onClick={() => setDialog("sign")}
              >
                Signer la convention
              </button>
            ) : (
              <Tooltip
                content={
                  waitLabel(convention)
                    ? `En attente de : ${waitLabel(convention)}.`
                    : "La convention n’attend pas votre signature."
                }
              >
                <span className="convention-disabled-action" tabIndex={0}>
                  <button className="submit-button" type="button" disabled>
                    Signer la convention
                  </button>
                </span>
              </Tooltip>
            )}
            {canReject ? (
              <button
                className="danger-outline-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setRejectionReason("");
                  setDialog("reject");
                }}
              >
                Refuser la convention
              </button>
            ) : (
              <Tooltip content="Cette convention ne peut plus être refusée.">
                <span className="convention-disabled-action" tabIndex={0}>
                  <button
                    className="danger-outline-button"
                    type="button"
                    disabled
                  >
                    Refuser la convention
                  </button>
                </span>
              </Tooltip>
            )}
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={downloadPdf}
            >
              <Download aria-hidden="true" size={15} />
              Télécharger le PDF
            </button>
          </div>
        </div>
        <aside className="convention-aside">
          <div className="info-card">
            <h2>Informations</h2>
            <p>
              <strong>Étudiant</strong>
              {convention.studentName}
            </p>
            <p>
              <strong>Offre</strong>
              {convention.offerTitle}
            </p>
            <p>
              <strong>Établissement</strong>
              {convention.etab || "—"}
            </p>
            <p>
              <strong>Créée le</strong>
              {formatDate(convention.createdAt)}
            </p>
            <p>
              <strong>Adresse de l’étudiant</strong>
              {/* NOT IN API YET: student address is not included in convention responses. */}
              {convention.studentAddress || "—"}
            </p>
            <p>
              <strong>Téléphone de l’étudiant</strong>
              {/* NOT IN API YET: student phone is not included in convention responses. */}
              {convention.studentPhone || "—"}
            </p>
          </div>
          <div className="info-card convention-history">
            <h2>Historique</h2>
            <ConventionTimeline
              events={events}
              showRejectionReason
              invalidatedLabel={
                convention.rejectionReason
                  ? "Signature annulée après refus"
                  : undefined
              }
            />
          </div>
          <VerificationCard convention={convention} onCopy={copyValue} />
        </aside>
      </div>
      {dialog === "sign" && (
        <ConfirmDialog
          open
          title="Signer la convention"
          body="Vérifiez le document avant de confirmer votre signature électronique."
          confirmLabel={busy ? "Signature…" : "Signer électroniquement"}
          confirmDisabled={!signatureAcknowledged || busy}
          confirmTooltip="Cochez la case pour confirmer votre lecture."
          onCancel={() => {
            setDialog(null);
            setSignatureAcknowledged(false);
          }}
          onConfirm={confirmSign}
        >
          <div className="company-convention-signature-fields">
            <p>
              <strong>Empreinte du document</strong>
              <code>{convention.pdfSha256?.slice(0, 12) || "—"}</code>
            </p>
            <label>
              <input
                type="checkbox"
                checked={signatureAcknowledged}
                onChange={(event) =>
                  setSignatureAcknowledged(event.target.checked)
                }
              />
              J’ai lu la convention et je la signe électroniquement
            </label>
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
          onConfirm={confirmReject}
        >
          <label className="company-convention-rejection-field">
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
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
