import {
  CheckCircle2,
  Download,
  Lock,
  Printer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConventionDocument from "../../components/convention/ConventionDocument";
import CompletionMeters from "../../components/convention/CompletionMeters";
import ConventionForm from "../../components/convention/ConventionForm";
import ConventionTimeline from "../../components/convention/ConventionTimeline";
import ConventionTracker from "../../components/convention/ConventionTracker";
import VerificationCard from "../../components/convention/VerificationCard";
import ErrorBanner from "../../components/ErrorBanner";
import LockedPage from "../../components/LockedPage";
import ModificationDialog from "../../components/convention/ModificationDialog";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import SignDialog from "../../components/convention/SignDialog";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import Tooltip from "../../components/ui/Tooltip";
import {
  computePartyProgress,
  computeCompletion,
  validateField,
} from "../../lib/conventionDocument";
import {
  getConventionPdfUrl,
  getMyConvention,
  requestStudentConventionModification,
  saveConventionFields,
  signConvention,
} from "../../services";

const trackerSteps = [
  { actorRole: "ETU" },
  { actorRole: "ENT" },
  { actorRole: "RESP" },
];

function isPresent(value) {
  return String(value ?? "").trim().length > 0;
}

function getMissingRequired(snapshot, values, source) {
  return (snapshot?.sections || []).flatMap((section) =>
    (section.fields || [])
      .filter(
        (field) =>
          field.source === source &&
          field.required &&
          !isPresent(values?.[field.key]),
      )
      .map((field) => field.label),
  );
}

function getWaitingFor(convention) {
  if (convention.state === "APPROVED") return "";
  if (convention.state === "DRAFT") return "le responsable";
  if (convention.currentActorId === convention.studentId) return "vous";
  if (convention.currentActorId === convention.companyId) return "l’entreprise";
  if (String(convention.currentActorId || "").startsWith("RESP#")) {
    return "le responsable";
  }
  return "";
}

function getActiveSignatureEvents(convention) {
  const events = convention?.events || [];
  const circuitRestart = events.reduce(
    (lastIndex, event, index) =>
      ["MODIFIED", "REJECTED", "RESUBMITTED"].includes(event.type)
        ? index
        : lastIndex,
    -1,
  );
  return events
    .slice(circuitRestart + 1)
    .filter((event) => event.type === "SIGNED" && !event.invalidated);
}

export default function Convention() {
  const [convention, setConvention] = useState(null);
  const [draftValues, setDraftValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [modificationDialogOpen, setModificationDialogOpen] = useState(false);
  const [toast, setToast] = useState("");

  const loadConvention = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextConvention = await getMyConvention();
      setConvention(nextConvention);
      setDraftValues(nextConvention?.values || {});
      setFieldErrors({});
      setTouched({});
      setSubmitted(false);
    } catch (loadError) {
      setError({
        title: "Impossible de charger la convention",
        message: loadError?.message || "Veuillez réessayer.",
        action: "load",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getMyConvention()
      .then((nextConvention) => {
        if (!active) return;
        setConvention(nextConvention);
        setDraftValues(nextConvention?.values || {});
      })
      .catch((loadError) => {
        if (!active) return;
        setError({
          title: "Impossible de charger la convention",
          message: loadError?.message || "Veuillez réessayer.",
          action: "load",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const snapshot = convention?.templateSnapshot;
  const studentFields = useMemo(
    () =>
      (snapshot?.sections || []).flatMap((section) =>
        (section.fields || []).filter((field) => field.source === "STUDENT"),
      ),
    [snapshot],
  );
  const dirtyFields = useMemo(
    () =>
      studentFields.filter(
        (field) =>
          String(draftValues[field.key] ?? "") !==
          String(convention?.values?.[field.key] ?? ""),
      ),
    [studentFields, draftValues, convention?.values],
  );
  const dirty = dirtyFields.length > 0;
  const signatureEvents = getActiveSignatureEvents(convention);
  const hasSignature = Boolean(
    convention &&
      (convention.state === "APPROVED" ||
        convention.frozenHash ||
        convention.signatures?.length),
  );
  const informationEditable = Boolean(convention && !hasSignature);
  const liveCompletion = useMemo(
    () => computeCompletion(snapshot, draftValues),
    [snapshot, draftValues],
  );
  const partyProgress = useMemo(
    () => computePartyProgress(snapshot, draftValues),
    [snapshot, draftValues],
  );
  const studentProgress = partyProgress.student;
  const companyProgress = partyProgress.company;
  const studentMissing = useMemo(
    () => getMissingRequired(snapshot, draftValues, "STUDENT"),
    [snapshot, draftValues],
  );
  const companyMissing = useMemo(
    () => getMissingRequired(snapshot, draftValues, "COMPANY"),
    [snapshot, draftValues],
  );
  const studentTurn = Boolean(
    convention?.state === "SUBMITTED" &&
      convention.currentActorId === convention.studentId &&
      !signatureEvents.some((event) => event.actorRole === "ETU"),
  );
  const canSign = Boolean(
    studentTurn && liveCompletion.complete && !dirty && !saving && !signing,
  );
  const turnMessage = useMemo(() => {
    if (!convention) return "";
    if (dirty) return "Enregistrez vos modifications.";
    if (saving) return "Enregistrement en cours.";
    if (fieldErrors && Object.values(fieldErrors).some(Boolean)) {
      return "Corrigez les champs signalés.";
    }
    if (studentMissing.length) {
      return `Il manque : ${studentMissing.slice(0, 3).join(", ")}${studentMissing.length > 3 ? "…" : ""}`;
    }
    if (companyMissing.length) return "L’entreprise doit compléter sa partie.";
    if (convention.state === "APPROVED") {
      return "La convention est déjà approuvée.";
    }
    if (!studentTurn) {
      const waitingFor = getWaitingFor(convention);
      return waitingFor === "vous"
        ? "La convention n’est pas encore prête à être signée."
        : `En attente de ${waitingFor || "l’étape suivante"}.`;
    }
    if (signing) return "Signature en cours.";
    return "";
  }, [
    convention,
    dirty,
    saving,
    fieldErrors,
    studentMissing,
    companyMissing,
    studentTurn,
    signing,
  ]);
  const invalidChangedFields = useMemo(
    () =>
      dirtyFields.filter(
        (field) =>
          validateField(field, draftValues[field.key]) ||
          fieldErrors[field.key],
      ),
    [dirtyFields, draftValues, fieldErrors],
  );
  const saveTooltip = !informationEditable
    ? "Le document est verrouillé après une signature."
    : saving
      ? "Enregistrement en cours."
      : invalidChangedFields.length
        ? "Corrigez les champs signalés avant d’enregistrer."
        : dirty
          ? ""
          : "Aucune modification à enregistrer.";
  const saveDisabled =
    !informationEditable || saving || !dirty || invalidChangedFields.length > 0;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const previewConvention = useMemo(() => {
    if (!convention || !dirty) return convention;
    return {
      ...convention,
      values: draftValues,
      documentHash: "",
      frozenHash: null,
    };
  }, [convention, dirty, draftValues]);
  const events = useMemo(
    () => {
      const sourceEvents = convention?.events || [];
      const circuitRestart = sourceEvents.reduce(
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
            (index < circuitRestart && event.type === "SIGNED"),
        }))
        .sort(
        (left, right) =>
          new Date(left.timestamp).getTime() -
          new Date(right.timestamp).getTime(),
        );
    },
    [convention?.events],
  );
  const trackerDone = trackerSteps.map(
    (step) =>
      convention?.state === "APPROVED" ||
      signatureEvents.some((event) => event.actorRole === step.actorRole),
  );
  const waitingFor = convention ? getWaitingFor(convention) : "";

  const showToast = useCallback((message) => {
    setToast(message);
  }, []);

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copié.`);
    } catch {
      showToast("Impossible de copier dans le presse-papiers.");
    }
  }

  function retryFailedAction() {
    switch (error?.action) {
      case "save":
        return saveInformation();
      case "sign":
        return sign();
      case "modify":
        return requestModification();
      case "download":
        return download();
      default:
        return loadConvention();
    }
  }

  function updateField(field, value) {
    setDraftValues((current) => ({ ...current, [field.key]: value }));
    setTouched((current) => ({ ...current, [field.key]: true }));
    setFieldErrors((current) => ({
      ...current,
      [field.key]: validateField(field, value) || "",
    }));
  }

  function touchField(field) {
    setTouched((current) => ({ ...current, [field.key]: true }));
    setFieldErrors((current) => ({
      ...current,
      [field.key]: validateField(field, draftValues[field.key]) || "",
    }));
  }

  async function saveInformation(event) {
    event?.preventDefault();
    setSubmitted(true);
    const nextErrors = {};
    for (const field of dirtyFields) {
      const message = validateField(field, draftValues[field.key]);
      if (message) nextErrors[field.key] = message;
    }
    setFieldErrors((current) => ({ ...current, ...nextErrors }));
    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(dirtyFields.map((field) => [field.key, true])),
    }));
    if (Object.keys(nextErrors).length) return;
    if (!dirtyFields.length) return;

    setSaving(true);
    setError(null);
    try {
      const values = Object.fromEntries(
        dirtyFields.map((field) => [field.key, draftValues[field.key] ?? ""]),
      );
      const updated = await saveConventionFields(values);
      setConvention(updated);
      setDraftValues(updated.values || {});
      setFieldErrors({});
      setTouched({});
      setSubmitted(false);
      showToast("Vos informations ont été enregistrées.");
    } catch (saveError) {
      const serverFields = saveError?.details?.messages || {};
      if (Object.keys(serverFields).length) {
        setFieldErrors((current) => ({ ...current, ...serverFields }));
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.keys(serverFields).map((key) => [key, true]),
          ),
        }));
      }
      setError({
        title: "Impossible d’enregistrer vos informations",
        message: saveError?.message || "Veuillez vérifier les champs et réessayer.",
        action: "save",
      });
    } finally {
      setSaving(false);
    }
  }

  async function sign() {
    if (!canSign) return;
    setSigning(true);
    setError(null);
    try {
      const updated = await signConvention(convention.conventionId);
      setConvention(updated);
      setDraftValues(updated.values || {});
      setSignDialogOpen(false);
      showToast("Convention signée électroniquement.");
    } catch (signError) {
      setError({
        title: "Impossible de signer la convention",
        message: signError?.message || "Veuillez réessayer.",
        action: "sign",
      });
    } finally {
      setSigning(false);
    }
  }

  async function requestModification() {
    setModifying(true);
    setError(null);
    try {
      const updated = await requestStudentConventionModification(
        convention.conventionId,
      );
      setConvention(updated);
      setDraftValues(updated.values || {});
      setFieldErrors({});
      setTouched({});
      setModificationDialogOpen(false);
      showToast("La convention repasse en brouillon. Les signatures ont été annulées.");
    } catch (modificationError) {
      setError({
        title: "Impossible de demander une modification",
        message: modificationError?.message || "Veuillez réessayer.",
        action: "modify",
      });
    } finally {
      setModifying(false);
    }
  }

  async function download() {
    setError(null);
    try {
      const result = await getConventionPdfUrl(convention.conventionId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError({
        title: "Impossible de préparer le téléchargement",
        message: downloadError?.message || "Veuillez réessayer.",
        action: "download",
      });
    }
  }

  if (loading) {
    return (
      <section className="student-page convention-page" aria-label="Chargement">
        <Skeleton className="convention-skeleton-heading" />
        <div className="student-convention-layout">
          <div className="convention-loading-card">
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
          <div className="convention-loading-card">
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        </div>
      </section>
    );
  }

  if (!convention) {
    return (
      <>
        {error && (
          <ErrorBanner
            title={error.title}
            message={error.message}
            onRetry={retryFailedAction}
          />
        )}
        <LockedPage
          eyebrow="Document officiel"
          title="Ma convention de stage"
          requirements={[
            { label: "Confirmer un stage accepté", done: false },
          ]}
          ctaLabel="Voir mes candidatures"
          ctaTo="/student/candidatures"
          preview={
            <div className="document-skeleton">
              <span />
              <span />
              <span />
              <span />
            </div>
          }
        />
      </>
    );
  }

  const modifiedEvent = [...events]
    .reverse()
    .find((event) => event.type === "MODIFIED" && !event.invalidated);
  const canRequestModification = hasSignature && convention.state !== "DRAFT";
  return (
    <section className="student-page convention-page">
      <PageHeader
        eyebrow="Document officiel"
        title="Ma convention de stage"
        subtitle="Complétez, vérifiez et suivez votre convention de stage."
        action={<StatusBadge status={convention.state} />}
      />
      <ConventionTracker doneSteps={trackerDone} waitingFor={waitingFor} />

      <CompletionMeters
        studentProgress={studentProgress}
        companyProgress={companyProgress}
        dirty={dirty}
      />

      {error && (
        <ErrorBanner
          title={error.title}
          message={error.message}
          onRetry={retryFailedAction}
          onClose={() => setError(null)}
        />
      )}
      {convention.state === "DRAFT" && convention.rejectionReason && (
        <div className="convention-rejected" role="alert">
          <strong>Convention refusée</strong>
          <span>{convention.rejectionReason}</span>
          <small>
            Le responsable doit corriger le document avant son renvoi.
          </small>
        </div>
      )}
      {convention.state === "DRAFT" && modifiedEvent && (
        <div className="convention-modified-banner" role="status">
          <Lock aria-hidden="true" size={18} />
          <span>
            Les signatures ont été annulées. La convention est en brouillon et
            attend le responsable.
          </span>
        </div>
      )}
      {convention.state === "SIGNED_STUDENT" && (
        <div className="convention-state-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          <span>Votre partie est signée. En attente de l’entreprise.</span>
        </div>
      )}
      {convention.state === "SIGNED_COMPANY" && (
        <div className="convention-state-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          <span>
            Les signatures sont enregistrées. En attente du responsable.
          </span>
        </div>
      )}

      <div className="student-convention-layout">
        <div className="convention-main-column">
          <ConventionForm
            snapshot={snapshot}
            values={draftValues}
            source="STUDENT"
            heading="Mes informations"
            description="Renseignez uniquement les champs réservés à l’étudiant."
            editable={informationEditable}
            dirty={dirty}
            saving={saving}
            fieldErrors={fieldErrors}
            touched={touched}
            submitted={submitted}
            onChange={updateField}
            onBlur={touchField}
            onSave={saveInformation}
            saveTooltip={saveTooltip}
            saveDisabled={saveDisabled}
            dirtyFieldCount={dirtyFields.length}
            showDirtyCount={dirty && invalidChangedFields.length === 0}
            profilePath="/student/profil"
            requestModification={canRequestModification}
            onRequestModification={() => setModificationDialogOpen(true)}
            lockedMessage="Verrouillé : le document est signé. Toute modification annule les signatures."
          />
        </div>

        <aside className="convention-aside student-convention-aside">
          <section aria-label="Aperçu de la convention">
            <div className="student-document-heading">
              <div>
                <h3>Document de convention</h3>
                {dirty && (
                  <span className="unsaved-document-label">
                    Aperçu des modifications non enregistrées
                  </span>
                )}
              </div>
            </div>
            <ConventionDocument
              convention={previewConvention}
              highlightParty="STUDENT"
            />
          </section>

          <div className="document-actions convention-action-bar">
            <Tooltip content={turnMessage || "Signer la convention."}>
              <span
                className="convention-disabled-action"
                tabIndex={canSign ? undefined : 0}
              >
                <button
                  className="submit-button"
                  type="button"
                  disabled={!canSign}
                  onClick={() => setSignDialogOpen(true)}
                >
                  {signing ? "Signature…" : "Signer la convention"}
                </button>
              </span>
            </Tooltip>
            <button
              className="secondary-button"
              type="button"
              onClick={download}
            >
              <Download aria-hidden="true" size={15} />
              Télécharger le PDF
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => window.print()}
            >
              <Printer aria-hidden="true" size={15} />
              Imprimer
            </button>
          </div>

          <div className="info-card convention-history">
            <h3>Historique</h3>
            <ConventionTimeline events={events} showRejectionReason />
          </div>
          <VerificationCard convention={convention} onCopy={copyValue} />
        </aside>
      </div>

      {signDialogOpen && (
        <SignDialog
          open={signDialogOpen}
          fingerprint={convention.documentHash?.slice(0, 12)}
          busy={signing}
          canConfirm={canSign}
          confirmTooltip={turnMessage}
          onCancel={() => setSignDialogOpen(false)}
          onConfirm={sign}
        />
      )}
      {modificationDialogOpen && (
        <ModificationDialog
          open={modificationDialogOpen}
          counterpart="l’entreprise"
          busy={modifying}
          onCancel={() => setModificationDialogOpen(false)}
          onConfirm={requestModification}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
