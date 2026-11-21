import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, Lock, Printer } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import CompletionMeters from "../convention/CompletionMeters";
import ConventionDocument from "../convention/ConventionDocument";
import ConventionForm from "../convention/ConventionForm";
import ConventionTimeline from "../convention/ConventionTimeline";
import ConventionTracker from "../convention/ConventionTracker";
import ModificationDialog from "../convention/ModificationDialog";
import SignDialog from "../convention/SignDialog";
import VerificationCard from "../convention/VerificationCard";
import ConfirmDialog from "../ui/ConfirmDialog";
import PageHeader from "../ui/PageHeader";
import Skeleton from "../ui/Skeleton";
import StatusBadge from "../ui/StatusBadge";
import Toast from "../ui/Toast";
import Tooltip from "../ui/Tooltip";
import {
  computeCompletion,
  computePartyProgress,
  validateField,
} from "../../lib/conventionDocument";
import {
  getConvention,
  getConventionPdfUrl,
  rejectConvention,
  requestCompanyConventionModification,
  saveCompanyConventionFields,
  signConvention,
} from "../../services.company";

const STATE_LABELS = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  SIGNED_STUDENT: "Signée par l’étudiant",
  SIGNED_COMPANY: "Signée par l’entreprise",
  APPROVED: "Approuvée",
};
const REJECTABLE_STATES = ["SUBMITTED", "SIGNED_STUDENT", "SIGNED_COMPANY"];

function localDateValue() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getCompanyDateKeys(snapshot) {
  const period = snapshot?.sections?.find((section) => section.id === "period");
  const dateFields = (period?.fields || []).filter(
    (field) => field.source === "COMPANY" && field.type === "date",
  );
  return {
    start: dateFields.find((field) => /début/i.test(field.label))?.key,
    end: dateFields.find((field) => /fin/i.test(field.label))?.key,
  };
}

function getSupervisorDateKey(snapshot) {
  const section = snapshot?.sections?.find(
    (item) => item.id === "supervisor",
  );
  return section?.fields?.find(
    (field) =>
      field.source === "COMPANY" &&
      field.type === "date" &&
      field.label.toLocaleLowerCase("fr") === "date",
  )?.key;
}

function periodEndMessage(values, dateKeys) {
  if (!dateKeys.start || !dateKeys.end) return "";
  const start = values[dateKeys.start];
  const end = values[dateKeys.end];
  if (!start || !end || validateField({ type: "date" }, start) || validateField({ type: "date" }, end)) {
    return "";
  }
  return end <= start
    ? "La date de fin doit être postérieure à la date de début."
    : "";
}

function durationHint(values, dateKeys) {
  const message = periodEndMessage(values, dateKeys);
  if (message) return message;
  const start = values[dateKeys.start];
  const end = values[dateKeys.end];
  if (!start || !end) return "Renseignez les dates pour calculer la durée.";
  const weeks = Math.ceil(
    (new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) /
      (7 * 24 * 60 * 60 * 1000),
  );
  if (!Number.isFinite(weeks) || weeks < 1) {
    return "Renseignez une période de stage valide.";
  }
  return `${weeks} semaine${weeks === 1 ? "" : "s"} entre les dates saisies.`;
}

function waitLabel(convention, companyId) {
  if (convention.state === "APPROVED") return undefined;
  if (convention.currentActorId === companyId) return "vous";
  if (convention.currentActorId === convention.studentId) return "l’étudiant";
  if (String(convention.currentActorId || "").startsWith("RESP#")) {
    return "le responsable";
  }
  return "l’étudiant";
}

function errorTitle(error) {
  if (error?.status === 400) return "Informations invalides";
  if (error?.status === 403) return "Accès refusé";
  if (error?.status === 404) return "Convention introuvable";
  if (error?.status === 409) return "Action impossible";
  return "Impossible de charger la convention";
}

function activeSignatures(events) {
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
  const [draftValues, setDraftValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [errorAction, setErrorAction] = useState("load");
  const [retry, setRetry] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = "Convention · PFE Connect";
  }, []);

  useEffect(() => {
    let active = true;
    getConvention(conventionId)
      .then((result) => {
        if (!active) return;
        const values = { ...(result.values || {}) };
        const dateKey = getSupervisorDateKey(result.templateSnapshot);
        if (dateKey && !values[dateKey]) values[dateKey] = localDateValue();
        setConvention(result);
        setDraftValues(values);
        setFieldErrors({});
        setTouched({});
        setSubmitted(false);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setConvention(null);
        setError(loadError);
        setErrorAction("load");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conventionId, retry]);

  const snapshot = convention?.templateSnapshot;
  const companyId = convention?.companyId;
  const companyFields = useMemo(
    () =>
      (snapshot?.sections || []).flatMap((section) =>
        (section.fields || []).filter((field) => field.source === "COMPANY"),
      ),
    [snapshot],
  );
  const dirtyFields = useMemo(
    () =>
      companyFields.filter(
        (field) =>
          String(draftValues[field.key] ?? "") !==
          String(convention?.values?.[field.key] ?? ""),
      ),
    [companyFields, convention?.values, draftValues],
  );
  const dirty = dirtyFields.length > 0;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const dateKeys = useMemo(() => getCompanyDateKeys(snapshot), [snapshot]);
  const periodError = periodEndMessage(draftValues, dateKeys);
  const completion = useMemo(
    () => computeCompletion(snapshot, draftValues),
    [snapshot, draftValues],
  );
  const partyProgress = useMemo(
    () => computePartyProgress(snapshot, draftValues),
    [snapshot, draftValues],
  );
  const studentMissing = useMemo(
    () =>
      (snapshot?.sections || []).flatMap((section) =>
        (section.fields || [])
          .filter(
            (field) =>
              field.source === "STUDENT" &&
              field.required &&
              !String(draftValues[field.key] ?? "").trim(),
          )
          .map((field) => field.label),
      ),
    [snapshot, draftValues],
  );
  const companyMissing = useMemo(
    () =>
      (snapshot?.sections || []).flatMap((section) =>
        (section.fields || [])
          .filter(
            (field) =>
              field.source === "COMPANY" &&
              field.required &&
              !String(draftValues[field.key] ?? "").trim(),
          )
          .map((field) => field.label),
      ),
    [snapshot, draftValues],
  );
  const hasSignature = Boolean(
    convention &&
      (convention.state === "APPROVED" ||
        convention.frozenHash ||
        convention.signatures?.length),
  );
  const editable = Boolean(convention && !hasSignature);
  const invalidChangedFields = dirtyFields.filter(
    (field) =>
      validateField(field, draftValues[field.key]) || fieldErrors[field.key],
  );
  const periodDateChanged = dirtyFields.some(
    (field) => field.key === dateKeys.start || field.key === dateKeys.end,
  );
  const invalidDraft =
    invalidChangedFields.length > 0 || Boolean(periodError && periodDateChanged);
  const saveDisabled = !editable || saving || !dirty || invalidDraft;
  const saveTooltip = !editable
    ? "Le document est verrouillé après une signature."
    : saving
      ? "Enregistrement en cours."
      : invalidDraft
        ? "Corrigez les champs signalés avant d’enregistrer."
        : dirty
          ? ""
          : "Aucune modification à enregistrer.";
  const activeEvents = activeSignatures(convention?.events || []);
  const isCompanyTurn = Boolean(
    convention?.state === "SIGNED_STUDENT" &&
      convention.currentActorId === companyId,
  );
  const canSign = Boolean(
    isCompanyTurn &&
      completion.complete &&
      !dirty &&
      !saving &&
      !busy &&
      !periodError,
  );
  const signTooltip = useMemo(() => {
    if (dirty) return "Enregistrez vos modifications.";
    if (saving || busy) return "Une action est en cours.";
    if (convention?.state === "SUBMITTED") {
      return "L’étudiant doit d’abord signer.";
    }
    if (studentMissing.length) {
      return `Il manque à l’étudiant : ${studentMissing.slice(0, 3).join(", ")}${studentMissing.length > 3 ? "…" : ""}`;
    }
    if (companyMissing.length) {
      return `Complétez la partie entreprise : ${companyMissing.slice(0, 3).join(", ")}${companyMissing.length > 3 ? "…" : ""}`;
    }
    if (periodError) return periodError;
    if (convention?.state === "APPROVED") return "La convention est déjà approuvée.";
    if (convention?.state === "SIGNED_COMPANY") {
      return "La convention attend l’approbation du responsable.";
    }
    if (String(convention?.currentActorId || "").startsWith("RESP#")) {
      return "La convention attend le responsable.";
    }
    return "L’étudiant doit d’abord signer.";
  }, [
    busy,
    companyMissing,
    convention,
    dirty,
    periodError,
    saving,
    studentMissing,
  ]);
  const studentProgress = partyProgress.student;
  const companyProgress = partyProgress.company;
  const previewConvention = useMemo(() => {
    if (!convention || !dirty) return convention;
    return {
      ...convention,
      values: draftValues,
      documentHash: "",
      frozenHash: null,
    };
  }, [convention, dirty, draftValues]);
  const events = useMemo(() => {
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
  }, [convention?.events]);
  const trackerDone = [
    convention?.state === "APPROVED" ||
      activeEvents.some((event) => event.actorRole === "ETU"),
    convention?.state === "APPROVED" ||
      activeEvents.some((event) => event.actorRole === "ENT"),
    convention?.state === "APPROVED" ||
      activeEvents.some((event) => event.actorRole === "RESP"),
    convention?.state === "APPROVED",
  ];
  const canReject = REJECTABLE_STATES.includes(convention?.state);
  const canRequestModification = hasSignature && convention.state !== "DRAFT";
  const modificationEvent = [...events]
    .reverse()
    .find((event) => event.type === "MODIFIED" && !event.invalidated);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setRetry((value) => value + 1);
  }, []);

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copié.`);
    } catch {
      setToast("Impossible de copier dans le presse-papiers.");
    }
  }

  function updateField(field, value) {
    setDraftValues((current) => ({ ...current, [field.key]: value }));
    setTouched((current) => ({
      ...current,
      [field.key]: true,
      ...(field.key === dateKeys.start || field.key === dateKeys.end
        ? { [dateKeys.end]: true }
        : {}),
    }));
    setFieldErrors((current) => ({
      ...current,
      [field.key]: validateField(field, value) || "",
      ...(dateKeys.end ? { [dateKeys.end]: "" } : {}),
    }));
  }

  function touchField(field) {
    setTouched((current) => ({
      ...current,
      [field.key]: true,
      ...(field.key === dateKeys.start || field.key === dateKeys.end
        ? { [dateKeys.end]: true }
        : {}),
    }));
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
    if (periodError && dateKeys.end) nextErrors[dateKeys.end] = periodError;
    setFieldErrors((current) => ({ ...current, ...nextErrors }));
    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(dirtyFields.map((field) => [field.key, true])),
      ...(dateKeys.end && periodError ? { [dateKeys.end]: true } : {}),
    }));
    if (Object.keys(nextErrors).length || !dirtyFields.length) return;

    setSaving(true);
    setError(null);
    try {
      const values = Object.fromEntries(
        dirtyFields.map((field) => [field.key, draftValues[field.key] ?? ""]),
      );
      const updated = await saveCompanyConventionFields(
        conventionId,
        values,
      );
      setConvention(updated);
      setDraftValues(updated.values || {});
      setFieldErrors({});
      setTouched({});
      setSubmitted(false);
      setToast("Vos informations ont été enregistrées.");
    } catch (saveError) {
      const messages = saveError?.details?.messages || {};
      if (Object.keys(messages).length) {
        setFieldErrors((current) => ({ ...current, ...messages }));
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(Object.keys(messages).map((key) => [key, true])),
        }));
      }
      setError(saveError);
      setErrorAction("save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSign() {
    setBusy(true);
    setError(null);
    try {
      const updated = await signConvention(conventionId);
      setConvention(updated);
      setDraftValues(updated.values || {});
      setDialog(null);
      setToast("Convention signée électroniquement.");
    } catch (signError) {
      setError(signError);
      setErrorAction("sign");
      if (signError?.status === 409) {
        try {
          setConvention(await getConvention(conventionId));
        } catch (refreshError) {
          setError(refreshError);
          setErrorAction("load");
        }
      }
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
      setDraftValues(updated.values || {});
      setDialog(null);
      setRejectionReason("");
      setToast("Convention refusée. Les signatures ont été annulées.");
    } catch (rejectError) {
      setError(rejectError);
      setErrorAction("reject");
    } finally {
      setBusy(false);
    }
  }

  async function requestModification() {
    setBusy(true);
    setError(null);
    try {
      const updated = await requestCompanyConventionModification(conventionId);
      setConvention(updated);
      setDraftValues(updated.values || {});
      setFieldErrors({});
      setTouched({});
      setDialog(null);
      setToast("Les signatures ont été annulées. La convention repasse en brouillon.");
    } catch (modificationError) {
      setError(modificationError);
      setErrorAction("modify");
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
    switch (errorAction) {
      case "save":
        return saveInformation();
      case "sign":
        return confirmSign();
      case "reject":
        return confirmReject();
      case "modify":
        return requestModification();
      case "download":
        return downloadPdf();
      default:
        return retryLoad();
    }
  }

  if (loading || (convention && convention.conventionId !== conventionId)) {
    return <ConventionDetailSkeleton />;
  }

  if (!convention) {
    return (
      <section className="company-convention-detail-page">
        <PageHeader eyebrow="Espace entreprise" title="Convention" />
        {error && (
          <ErrorBanner
            title={errorTitle(error)}
            message={error.message || "Cette convention n’est pas disponible."}
            onRetry={retryFailedAction}
          />
        )}
        <Link className="company-convention-back" to="/company/conventions">
          <ArrowLeft aria-hidden="true" size={16} />
          Toutes les conventions
        </Link>
      </section>
    );
  }

  const waitFor = waitLabel(convention, companyId);
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
          onRetry={retryFailedAction}
          onClose={() => setError(null)}
        />
      )}
      {convention.state === "DRAFT" && convention.rejectionReason ? (
        <div className="convention-rejected" role="alert">
          <strong>Convention refusée</strong>
          <span>{convention.rejectionReason}</span>
          <small>Le responsable doit corriger le document avant son renvoi.</small>
        </div>
      ) : convention.state === "DRAFT" && modificationEvent ? (
        <div className="convention-modified-banner" role="alert">
          <Lock aria-hidden="true" size={17} />
          <span>
            Les signatures ont été annulées. La convention est en brouillon et
            attend le responsable.
          </span>
        </div>
      ) : null}
      {convention.state === "SUBMITTED" && (
        <div className="convention-state-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          <span>L’étudiant doit d’abord signer la convention.</span>
        </div>
      )}
      {convention.state === "SIGNED_STUDENT" && (
        <div className="convention-state-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          <span>La convention attend votre signature.</span>
        </div>
      )}
      {convention.state === "SIGNED_COMPANY" && (
        <div className="convention-state-banner" role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          <span>En attente de l’approbation du responsable.</span>
        </div>
      )}
      <ConventionTracker
        doneSteps={trackerDone}
        waitingFor={waitFor}
      />
      <CompletionMeters
        studentProgress={studentProgress}
        companyProgress={companyProgress}
        dirty={dirty}
      />

      <div className="student-convention-layout">
        <div className="convention-main-column">
          <ConventionForm
            snapshot={snapshot}
            values={draftValues}
            source="COMPANY"
            heading="Mes informations"
            description="Complétez uniquement les champs réservés à l’entreprise."
            editable={editable}
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
            profilePath="/company/profil"
            requestModification={canRequestModification}
            onRequestModification={() => setDialog("modify")}
            lockedMessage="Verrouillé : le document est signé. Toute modification annule les signatures."
            periodErrorFieldKey={dateKeys.end}
            periodError={periodError}
            durationHint={durationHint(draftValues, dateKeys)}
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
              highlightParty="COMPANY"
            />
          </section>

          <div className="document-actions convention-action-bar">
            <Tooltip content={signTooltip}>
              <span
                className="convention-disabled-action"
                tabIndex={canSign ? undefined : 0}
              >
                <button
                  className="submit-button"
                  type="button"
                  disabled={!canSign}
                  onClick={() => setDialog("sign")}
                >
                  Signer la convention
                </button>
              </span>
            </Tooltip>
            <Tooltip
              content={
                canReject
                  ? "Refuser la convention et saisir un motif obligatoire."
                  : "Cette convention ne peut plus être refusée."
              }
            >
              <span
                className="convention-disabled-action"
                tabIndex={canReject ? undefined : 0}
              >
                <button
                  className="danger-outline-button"
                  type="button"
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
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={downloadPdf}
                >
                  <Download aria-hidden="true" size={15} />
                  Télécharger le PDF
                </button>
              </span>
            </Tooltip>
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

      {dialog === "sign" && (
        <SignDialog
          open
          fingerprint={
            (convention.frozenHash || convention.documentHash)?.slice(0, 12)
          }
          busy={busy}
          canConfirm={canSign}
          confirmTooltip={signTooltip}
          onCancel={() => setDialog(null)}
          onConfirm={confirmSign}
        />
      )}
      {dialog === "modify" && (
        <ModificationDialog
          open
          counterpart="l’étudiant"
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={requestModification}
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
          onConfirm={confirmReject}
        >
          <label className="company-convention-rejection-field">
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
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
