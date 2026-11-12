import { AlertTriangle, CheckCircle2, Clock3, Download, FileText, UsersRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LockedPage from "../../components/LockedPage";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import useInternshipStatus from "../../hooks/useInternshipStatus";
import {
  createReportUploadUrl,
  getMySupervision,
  getReportPdfUrl,
  listMyReports,
  uploadToPresignedPost,
} from "../../services";
import ActionButton from "./parts/ActionButton";
import FileDropzone from "./parts/FileDropzone";
import RetryBanner from "./parts/RetryBanner";
import useUnsavedWarning from "./parts/useUnsavedWarning";
import { buttonVariants, card, chip, formatDate, quote, sectionTitle, tone } from "./parts/ui";

const MAX_BYTES = 20 * 1024 * 1024;
const POLL_EVERY = 3000;
const POLL_FOR = 30000;
const DECISIONS = {
  null: { label: "En attente", tone: tone.neutral },
  APPROVED: { label: "Approuvé", tone: tone.success },
  CHANGES_REQUESTED: { label: "Modifications demandées", tone: tone.amber },
};
const decisionOf = (value) => DECISIONS[value ?? "null"] || DECISIONS.null;
const shortHash = (value) => (value ? value.slice(0, 12) : "—");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const lockedPreview = (
  <div className="document-skeleton">
    <span />
    <span />
    <span />
  </div>
);

function ReviewerRow({ role, name, decision, comment }) {
  const { label, tone: toneClass } = decisionOf(decision);
  return (
    <div className="border-t border-[var(--border)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-[var(--text)]">
          <strong>{role}</strong>
          {name && <span className="text-[var(--muted)]"> · {name}</span>}
        </span>
        <span className={`${chip} ${toneClass}`}>{label}</span>
      </div>
      {comment && <blockquote className={`${quote} mt-2`}>{comment}</blockquote>}
    </div>
  );
}

export default function Report() {
  const { status, loading: statusLoading } = useInternshipStatus();
  const [data, setData] = useState({ loading: true, error: null, reports: [], supervision: null });
  const [retrying, setRetrying] = useState(false);
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | uploading | registering
  const [progress, setProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [downloading, setDownloading] = useState(null);
  const [toast, setToast] = useState("");
  const closeToast = useCallback(() => setToast(""), []);
  const dropzoneRef = useRef(null);
  const chooseButtonRef = useRef(null);

  const load = useCallback(() => {
    setData((value) => ({ ...value, error: null }));
    return Promise.all([listMyReports(), getMySupervision()])
      .then(([reports, supervision]) =>
        setData({ loading: false, error: null, reports: reports.items || [], supervision }),
      )
      .catch((error) => setData((value) => ({ ...value, loading: false, error })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useUnsavedWarning(phase !== "idle");

  async function upload() {
    if (!file || phase !== "idle") return;
    setUploadError("");
    const knownVersions = Math.max(0, ...data.reports.map((item) => item.version));
    try {
      setPhase("uploading");
      setProgress(0);
      const presigned = await createReportUploadUrl();
      await uploadToPresignedPost(presigned, file, setProgress);
      setPhase("registering");
      const deadline = Date.now() + POLL_FOR;
      while (Date.now() < deadline) {
        await wait(POLL_EVERY);
        const page = await listMyReports();
        const items = page.items || [];
        if (items.some((item) => item.version > knownVersions)) {
          setData((value) => ({ ...value, reports: items }));
          setFile(null);
          setToast("Rapport déposé, en cours de relecture");
          return;
        }
      }
      setUploadError("Le fichier a bien été envoyé, mais la version n’est pas encore enregistrée. Actualisez dans quelques instants.");
    } catch (error) {
      setUploadError(
        error?.status === 409
          ? "Un encadrant doit être associé à votre stage avant le dépôt."
          : error?.message || "Le dépôt a échoué. Réessayez.",
      );
    } finally {
      setPhase("idle");
      setProgress(null);
    }
  }

  async function download(version) {
    setDownloading(version);
    try {
      const { url } = await getReportPdfUrl(version);
      if (url.startsWith("#")) setToast("Téléchargement simulé : aucun fichier n’est associé à cette version de démonstration.");
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setToast(error?.message || "Le téléchargement a échoué.");
    } finally {
      setDownloading(null);
    }
  }

  function goToDropzone() {
    dropzoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    chooseButtonRef.current?.focus({ preventScroll: true });
  }

  if (statusLoading)
    return (
      <section className="student-page" aria-busy="true">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </section>
    );

  if (status !== "approved")
    return (
      <LockedPage
        eyebrow="Livrable final"
        title="Rapport de stage"
        requirements={[
          { label: "Convention créée", done: status !== "none" },
          { label: "Convention signée et approuvée", done: false },
        ]}
        ctaLabel="Voir ma convention"
        ctaTo="/student/convention"
        preview={lockedPreview}
      />
    );

  const { reports, supervision } = data;
  const latest = reports[0];
  const hasSupervisor = ["ACCEPTED", "ASSIGNED"].includes(supervision?.status);
  const isValidated = latest?.status === "VALIDATED";
  const busy = phase !== "idle";

  return (
    <section className="student-page">
      <PageHeader
        eyebrow="Livrable final"
        title="Rapport de stage"
        subtitle="Déposez votre rapport final et suivez les validations."
      />

      {data.error && (
        <RetryBanner
          title="Le rapport n’a pas pu être chargé"
          message={data.error.message}
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            load().finally(() => setRetrying(false));
          }}
        />
      )}

      {data.loading ? (
        <div aria-busy="true">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        !data.error && (
          <div className="flex flex-col gap-8">
            {latest?.status === "UNDER_REVIEW" && (
              <div className={`flex items-center gap-3 rounded-[4px] border px-4 py-3 ${tone.primary}`} role="status">
                <Clock3 size={18} aria-hidden="true" />
                <span className="text-[13px]">
                  <strong>Version {latest.version} en cours de relecture</strong> par l’entreprise et l’encadrant.
                </span>
              </div>
            )}
            {latest?.status === "CHANGES_REQUESTED" && (
              <div className={`flex flex-wrap items-center gap-3 rounded-[4px] border px-4 py-3 ${tone.amber}`} role="status">
                <AlertTriangle size={18} className="text-[var(--accent)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[13px]">
                  <strong>Des modifications sont demandées</strong> sur la version {latest.version}. Déposez une nouvelle version.
                </span>
                <button type="button" className={buttonVariants.secondary} onClick={goToDropzone}>
                  Déposer une nouvelle version
                </button>
              </div>
            )}
            {isValidated && (
              <div className={`${card} overflow-hidden`}>
                <div className={`flex items-center gap-2.5 border-0 border-b px-5 py-3 ${tone.success}`}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <strong className="text-[14px]">Rapport validé</strong>
                </div>
                <dl className="m-0 grid gap-4 p-5 sm:grid-cols-4">
                  {[
                    ["Date de dépôt", formatDate(latest.submittedAt)],
                    ["Version", `Version ${latest.version}`],
                    ["Entreprise", latest.companyName || "Approuvé"],
                    ["Encadrant", latest.teacherName || "Approuvé"],
                  ].map(([term, value]) => (
                    <div key={term}>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{term}</dt>
                      <dd className="m-0 mt-1 text-[14px] text-[var(--text)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div ref={dropzoneRef} className={`${card} p-6`}>
              <h2 className={sectionTitle}>{reports.length ? "Déposer une nouvelle version" : "Déposer votre rapport"}</h2>
              <p className="m-0 mb-4 mt-1 text-[13px] text-[var(--muted)]">
                Un seul fichier PDF. Chaque dépôt crée une nouvelle version.
              </p>
              <FileDropzone
                label="Glissez votre rapport ici"
                hint="PDF uniquement, 20 Mo maximum"
                accept="application/pdf,.pdf"
                mimeTypes={["application/pdf"]}
                extensions={[".pdf"]}
                maxBytes={MAX_BYTES}
                typeError="Seuls les fichiers PDF sont acceptés."
                sizeError="Fichier trop volumineux (20 Mo maximum)."
                file={file}
                onFile={(next) => {
                  setFile(next);
                  setUploadError("");
                }}
                progress={phase === "uploading" ? progress : phase === "registering" ? 100 : null}
                busy={busy}
                buttonRef={chooseButtonRef}
                disabled={!hasSupervisor || isValidated}
                disabledMessage={
                  isValidated
                    ? "Votre rapport est validé : aucun nouveau dépôt n’est nécessaire."
                    : "Choisissez d’abord un encadrant pour pouvoir déposer votre rapport."
                }
                disabledAction={
                  !hasSupervisor && !isValidated ? (
                    <Link to="/student/encadrant" className={buttonVariants.primary}>
                      <UsersRound size={15} aria-hidden="true" />
                      Choisir un encadrant
                    </Link>
                  ) : null
                }
              />
              {uploadError && (
                <p role="alert" className="m-0 mt-3 text-[12px] text-[var(--danger)]">
                  {uploadError}
                </p>
              )}
              {hasSupervisor && !isValidated && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <ActionButton
                    loading={busy}
                    disabledReason={!file ? "Choisissez d’abord un fichier PDF valide" : undefined}
                    onClick={upload}
                  >
                    {phase === "uploading"
                      ? `Envoi… ${progress ?? 0} %`
                      : phase === "registering"
                        ? "Enregistrement de la version…"
                        : "Déposer le rapport"}
                  </ActionButton>
                  {phase === "registering" && (
                    <span className="text-[12px] text-[var(--muted)]" aria-live="polite">
                      Le fichier est envoyé, la version est en cours d’enregistrement.
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <h2 className={sectionTitle}>Historique des versions</h2>
              <p className="m-0 mb-5 mt-2 max-w-[640px] text-[13px] leading-[1.6] text-[var(--muted)]">
                Le rapport est validé uniquement si l’entreprise et l’encadrant l’approuvent tous les deux. Chaque nouveau
                dépôt remet les deux avis à zéro.
              </p>
              {reports.length === 0 ? (
                <EmptyState
                  title="Aucune version déposée"
                  message="Vos versions déposées apparaîtront ici avec l’avis de l’entreprise et de l’encadrant."
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {reports.map((report) => (
                    <article key={report.version} className={`${card} flex flex-col gap-3 p-5`}>
                      <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-[4px] border border-[var(--border)] bg-[var(--bg)] text-[var(--primary)]">
                            <FileText size={18} aria-hidden="true" />
                          </span>
                          <div>
                            <h3 className={`${sectionTitle} text-[19px]!`}>Version {report.version}</h3>
                            <p className="m-0 mt-1 text-[12px] text-[var(--muted)]">
                              Déposée le {formatDate(report.submittedAt)} ·{" "}
                              <code className="font-mono text-[11px] text-[var(--text)]" title={report.sha256}>
                                {shortHash(report.sha256)}
                              </code>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={report.status} />
                          <ActionButton variant="secondary" loading={downloading === report.version} onClick={() => download(report.version)}>
                            {downloading !== report.version && <Download size={15} aria-hidden="true" />}
                            Télécharger
                          </ActionButton>
                        </div>
                      </header>
                      <ReviewerRow
                        role="Entreprise"
                        name={report.companyName}
                        decision={report.companyDecision}
                        comment={report.companyComment}
                      />
                      <ReviewerRow
                        role="Encadrant"
                        name={report.teacherName}
                        decision={report.teacherDecision}
                        comment={report.teacherComment}
                      />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {toast && <Toast message={toast} onClose={closeToast} />}
    </section>
  );
}
