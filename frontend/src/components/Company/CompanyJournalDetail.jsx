import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { CompanyAvatar } from "./CompanyVisuals";
import ErrorBanner from "../ErrorBanner";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import Skeleton from "../ui/Skeleton";
import StatusBadge from "../ui/StatusBadge";
import Toast from "../ui/Toast";
import {
  COMPANY_DATA_CHANGED_EVENT,
  listMyInterns,
  listStudentJournals,
  validateJournalEntry,
} from "../../services.company";
import { formatWeekRange, isoWeek } from "../../pages/student/parts/weeks";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function weekStatus(week, entry, currentWeek) {
  if (entry?.validated) return { code: "VALIDATED", label: "Validée" };
  if (entry) return { code: "SUBMITTED", label: "Soumise" };
  if (week < currentWeek) return { code: "PENDING", label: "En retard" };
  return { code: "DRAFT", label: "À rédiger" };
}

export default function CompanyJournalDetail() {
  const { studentId } = useParams();
  const [intern, setIntern] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [internResult, journalResult] = await Promise.all([
        listMyInterns({ limit: 100 }),
        listStudentJournals(studentId, { limit: 100 }),
      ]);
      const found = internResult.items.find(
        (item) => item.studentId === studentId,
      );
      if (!found) {
        const forbidden = new Error(
          "Ce stagiaire ne fait pas partie de votre entreprise.",
        );
        forbidden.status = 403;
        throw forbidden;
      }
      setIntern(found);
      setEntries(journalResult.items);
    } catch (error) {
      setLoadError(error);
      setIntern(null);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) void load();
    };
    Promise.resolve().then(refresh);
    window.addEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
    };
  }, [load]);

  const entryByWeek = useMemo(
    () => new Map(entries.map((entry) => [entry.week, entry])),
    [entries],
  );
  const currentWeek = isoWeek(new Date());
  const expectedWeeks = useMemo(
    () =>
      [...new Set([...(intern?.expectedWeeks || []), ...entries.map((item) => item.week)])]
        .sort((a, b) => b.localeCompare(a)),
    [intern, entries],
  );
  const noEntryForTwoWeeks = useMemo(() => {
    const recentPastWeeks = expectedWeeks
      .filter((week) => week < currentWeek)
      .slice(0, 2);
    return (
      recentPastWeeks.length === 2 &&
      recentPastWeeks.every((week) => !entryByWeek.has(week))
    );
  }, [currentWeek, entryByWeek, expectedWeeks]);

  async function submitValidation() {
    if (!selectedEntry) return;
    setBusy(true);
    setActionError("");
    try {
      await validateJournalEntry(
        studentId,
        selectedEntry.week,
        { comment },
      );
      setSelectedEntry(null);
      setComment("");
      setToast("L’entrée de journal a été validée.");
    } catch (error) {
      if (error?.status === 409) {
        await load();
        setActionError(
          "Cette entrée a déjà été validée. La liste a été actualisée.",
        );
      } else {
        setActionError(
          error?.message || "L’entrée n’a pas pu être validée.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const closeDialog = () => {
    setSelectedEntry(null);
    setComment("");
  };

  return (
    <section className="company-journal-detail flex flex-col gap-6">
      <Link
        to="/company/journaux"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour aux journaux
      </Link>

      {actionError && (
        <ErrorBanner
          title="Action impossible"
          message={actionError}
          onRetry={() => void load()}
          onClose={() => setActionError("")}
        />
      )}

      {loadError && (
        <ErrorBanner
          title={
            loadError.status === 403
              ? "Accès refusé (403)"
              : loadError.status === 404
                ? "Stagiaire introuvable (404)"
                : "Impossible de charger le journal"
          }
          message={
            loadError.message ||
            "Une erreur est survenue pendant le chargement du journal."
          }
          onRetry={() => void load()}
        />
      )}

      {loading ? (
        <div className="grid gap-3" aria-label="Chargement">
          <Skeleton className="h-28 rounded" />
          <Skeleton className="h-36 rounded" />
          <Skeleton className="h-36 rounded" />
        </div>
      ) : loadError ? null : intern ? (
        <>
          <header className="company-journal-detail-header">
            <CompanyAvatar name={intern.studentName} />
            <div className="min-w-0">
              <p className="company-eyebrow">Journal de stage</p>
              <span className="company-person-name">{intern.studentName}</span>
              <p className="company-intern-meta">{intern.offerTitle} · {intern.etab}</p>
            </div>
          </header>

          {noEntryForTwoWeeks && (
            <div className="rounded border border-accent-ink/30 bg-accent-tint p-4 text-sm text-accent-ink" role="status">
              Aucune entrée depuis 2 semaines pour ce stagiaire.
            </div>
          )}

          {expectedWeeks.length ? (
            <ol className="company-week-list">
              {expectedWeeks.map((week) => {
                const entry = entryByWeek.get(week);
                const status = weekStatus(week, entry, currentWeek);
                return (
                  <li
                    key={week}
                    className="company-week-card"
                  >
                    <div className="company-week-header">
                      <div>
                        <h3 className="company-week-title">{formatWeekRange(week)}</h3>
                        {entry?.submittedAt && (
                          <p className="company-week-submitted">Soumise le {formatDate(entry.submittedAt)}</p>
                        )}
                      </div>
                      <span className="company-nowrap"><StatusBadge status={status.code} label={status.label} /></span>
                    </div>

                    {entry ? (
                      <div className="company-week-entry">
                        <div className="company-entry-content">
                          <p>{entry.content}</p>
                        </div>
                        {entry.validated && (
                          <blockquote className="company-entry-comment">
                            <p>
                              Validée le {formatDate(entry.validatedAt)}
                            </p>
                            {entry.comment && (
                              <p className="mt-2 italic">« {entry.comment} »</p>
                            )}
                          </blockquote>
                        )}
                        {!entry.validated && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEntry(entry);
                              setComment("");
                            }}
                            className="company-primary-button"
                          >
                            <Check className="size-4" aria-hidden="true" />
                            Valider
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-ink-soft">
                        {status.label === "En retard"
                          ? "Aucune entrée n’a été déposée pour cette semaine."
                          : "L’entrée de cette semaine n’a pas encore été déposée."}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState
              title="Aucune semaine à afficher"
              message="Les semaines de stage apparaîtront ici."
              actionLabel="Retour aux journaux"
              actionTo="/company/journaux"
            />
          )}
        </>
      ) : (
        <EmptyState
          title="Stagiaire introuvable"
          message="Ce stagiaire ne fait pas partie des stagiaires suivis par votre entreprise."
          actionLabel="Retour aux journaux"
          actionTo="/company/journaux"
        />
      )}

      <ConfirmDialog
        open={Boolean(selectedEntry)}
        title="Valider cette entrée ?"
        body="Vous pouvez ajouter un commentaire facultatif avant de valider l’entrée."
        confirmLabel={busy ? "Validation…" : "Valider l'entrée"}
        confirmDisabled={busy}
        confirmTooltip={busy ? "Validation en cours." : undefined}
        onCancel={closeDialog}
        onConfirm={() => void submitValidation()}
      >
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          Commentaire (facultatif)
          <textarea
            value={comment}
            maxLength={1000}
            rows={4}
            onChange={(event) => setComment(event.target.value)}
            className="resize-y rounded border border-line bg-bg px-3 py-2 text-sm font-normal text-ink"
          />
          <span className="text-right text-xs font-normal text-ink-soft">
            {comment.length} / 1000
          </span>
        </label>
      </ConfirmDialog>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
