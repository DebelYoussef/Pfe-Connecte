import { AlertTriangle, BookOpen, Check, CheckCircle2, Clock3, History, PenLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LockedPage from "../../components/LockedPage";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import { getUser } from "../../auth";
import useInternshipStatus from "../../hooks/useInternshipStatus";
import { getInternshipPeriod, getMyConvention, listMyJournals, putJournalEntry } from "../../services.js";
import ActionButton from "./parts/ActionButton";
import ExportMenu from "./parts/ExportMenu";
import RetryBanner from "./parts/RetryBanner";
import useUnsavedWarning from "./parts/useUnsavedWarning";
import { card, chip, focusRing, formatDate, formatTime, quote, sectionTitle, tone } from "./parts/ui";
import { formatWeekRange, isoWeek, weekNumber, weeksBetween, weekStart } from "./parts/weeks";

const MAX_LENGTH = 5000;
const draftKey = (week) => `journal-draft-${week}`;
const readDraft = (week) => {
  try {
    return localStorage.getItem(draftKey(week));
  } catch {
    return null;
  }
};
const writeDraft = (week, text) => {
  try {
    if (text) localStorage.setItem(draftKey(week), text);
    else localStorage.removeItem(draftKey(week));
  } catch {
    /* storage full or blocked: the draft simply is not kept */
  }
};

const STATES = {
  todo: { label: "À rédiger", tone: tone.neutral },
  draft: { label: "Brouillon", tone: tone.primary },
  submitted: { label: "Soumise", tone: tone.primary },
  validated: { label: "Validée", tone: tone.success },
  late: { label: "En retard", tone: tone.amber },
};

function weekState(week, entry, draft, currentWeek) {
  if (entry?.validated) return "validated";
  if (draft && draft !== (entry?.content || "")) return "draft";
  if (entry) return "submitted";
  return week < currentWeek ? "late" : "todo";
}

function StateBadge({ state }) {
  const { label, tone: toneClass } = STATES[state];
  return <span className={`${chip} ${toneClass}`}>{label}</span>;
}

const lockedPreview = (
  <div className="document-skeleton">
    <span />
    <span />
    <span />
  </div>
);

export default function Journal() {
  const { status, loading: statusLoading } = useInternshipStatus();
  const [data, setData] = useState({ loading: true, error: null, entries: [], convention: null, period: null });
  const [retrying, setRetrying] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("write");
  const [content, setContent] = useState("");
  const [drafts, setDrafts] = useState({});
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const closeToast = useCallback(() => setToast(""), []);
  const contentRef = useRef("");
  const lastDraftRef = useRef(null);

  const today = useMemo(() => new Date(), []);
  const currentWeek = isoWeek(today);

  const load = useCallback(() => {
    setData((value) => ({ ...value, loading: value.entries.length === 0, error: null }));
    return Promise.all([listMyJournals(), getMyConvention(), getInternshipPeriod()])
      .then(([journals, convention, period]) =>
        setData({ loading: false, error: null, entries: journals.items || [], convention, period }),
      )
      .catch((error) => setData((value) => ({ ...value, loading: false, error })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weeks = useMemo(() => {
    if (!data.period?.startDate) return [currentWeek];
    return weeksBetween(new Date(`${data.period.startDate}T00:00:00`), today);
  }, [data.period, today, currentWeek]);

  const entriesByWeek = useMemo(
    () => Object.fromEntries(data.entries.map((entry) => [entry.week, entry])),
    [data.entries],
  );

  // Restore saved drafts once the weeks are known.
  useEffect(() => {
    setDrafts(Object.fromEntries(weeks.map((week) => [week, readDraft(week)]).filter(([, text]) => text)));
  }, [weeks]);

  // Open on the current week.
  useEffect(() => {
    if (!data.loading && !selected) openWeek(weeks[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading, weeks]);

  const entry = selected ? entriesByWeek[selected] : null;
  const validated = Boolean(entry?.validated);
  const unsaved = !validated && content.trim() !== "" && content !== (entry?.content || "");
  useUnsavedWarning(unsaved);

  function openWeek(week) {
    if (!week) return;
    if (selected) flushDraft();
    const saved = entriesByWeek[week];
    const draft = readDraft(week);
    const text = saved?.validated ? saved.content : draft ?? saved?.content ?? "";
    contentRef.current = text;
    lastDraftRef.current = draft;
    setSelected(week);
    setContent(text);
    setSavedAt(null);
    setDraftSavedAt(null);
    setSaveError("");
    setTab("write");
  }

  function flushDraft() {
    if (!selected || validated) return;
    const text = contentRef.current;
    const keep = text.trim() && text !== (entriesByWeek[selected]?.content || "") ? text : "";
    if (keep === (lastDraftRef.current || "")) return;
    writeDraft(selected, keep);
    lastDraftRef.current = keep || null;
    setDrafts((value) => {
      const next = { ...value };
      if (keep) next[selected] = keep;
      else delete next[selected];
      return next;
    });
    if (keep) setDraftSavedAt(new Date());
  }

  // Autosave the draft every 2 seconds while the text changes.
  useEffect(() => {
    if (!selected || validated) return undefined;
    const timer = setInterval(flushDraft, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, validated, entry]);

  async function save() {
    if (!content.trim() || saving || validated) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await putJournalEntry(selected, content);
      setData((value) => ({
        ...value,
        entries: [...value.entries.filter((item) => item.week !== selected), saved],
      }));
      writeDraft(selected, "");
      lastDraftRef.current = null;
      setDrafts((value) => {
        const next = { ...value };
        delete next[selected];
        return next;
      });
      setSavedAt(new Date());
      setDraftSavedAt(null);
      setToast("Entrée enregistrée");
    } catch (error) {
      setSaveError(
        error?.status === 409
          ? "Cette entrée a déjà été validée par l’entreprise : elle ne peut plus être modifiée."
          : error?.message || "L’enregistrement a échoué. Réessayez.",
      );
      if (error?.status === 409) load();
    } finally {
      setSaving(false);
    }
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
        eyebrow="Suivi hebdomadaire"
        title="Journal de stage"
        requirements={[
          { label: "Convention créée", done: status !== "none" },
          { label: "Convention signée et approuvée", done: false },
        ]}
        ctaLabel="Voir ma convention"
        ctaTo="/student/convention"
        preview={lockedPreview}
      />
    );

  const user = getUser() || {};
  const studentName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "";
  const companyName = data.convention?.companyName || "";
  const validatedCount = data.entries.filter((item) => item.validated && weeks.includes(item.week)).length;
  const history = [...data.entries].sort((a, b) => (a.week < b.week ? 1 : -1));
  const pastWeeks = weeks.filter((week) => week < currentWeek);
  const lastTwo = pastWeeks.slice(0, 2);
  const silentTwoWeeks = lastTwo.length === 2 && lastTwo.every((week) => !entriesByWeek[week]);
  const firstWeek = weeks[weeks.length - 1];
  const periodLabel = `${formatDate(weekStart(firstWeek))} – ${formatDate(today)}`;

  function exportText() {
    const lines = [
      "Journal de stage",
      `Étudiant : ${studentName}`,
      companyName && `Entreprise : ${companyName}`,
      `Période : ${periodLabel}`,
      "",
    ].filter((line) => line !== false && line !== "");
    history.forEach((item) => {
      const state = STATES[weekState(item.week, item, null, currentWeek)].label;
      lines.push(
        "",
        "----------------------------------------",
        `Semaine ${weekNumber(item.week)} (${formatWeekRange(item.week)}) — ${state}`,
        item.validatedAt ? `Validée le ${formatDate(item.validatedAt)}` : `Soumise le ${formatDate(item.submittedAt)}`,
        "",
        item.content,
      );
      if (item.comment) lines.push("", `Commentaire de l’entreprise : ${item.comment}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-de-stage${user.lastName ? `-${user.lastName.toLowerCase().replace(/\s+/g, "-")}` : ""}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="student-page">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Suivi hebdomadaire"
          title="Journal de stage"
          subtitle="Une entrée par semaine pour garder une trace de votre progression."
          action={
            <ExportMenu
              disabledReason={data.entries.length ? undefined : "Écrivez au moins une entrée pour exporter votre journal"}
              items={[
                { label: "Fichier texte (.txt)", onSelect: exportText },
                { label: "Version PDF (impression)", onSelect: () => window.print() },
              ]}
            />
          }
        />

        {data.error && (
          <RetryBanner
            title="Le journal n’a pas pu être chargé"
            message={data.error.message}
            retrying={retrying}
            onRetry={() => {
              setRetrying(true);
              load().finally(() => setRetrying(false));
            }}
          />
        )}

        {data.loading ? (
          <div className="grid gap-6 md:grid-cols-[300px_1fr]" aria-busy="true">
            <div>
              {[0, 1, 2, 3, 4].map((item) => (
                <Skeleton key={item} />
              ))}
            </div>
            <Skeleton className="journal-editor-skeleton" />
          </div>
        ) : (
          !data.error && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-4">
                <div className={`${card} flex min-w-[260px] flex-1 items-center gap-4 px-4 py-3`}>
                  <span className="text-[12px] font-semibold text-[var(--muted)]">Semaines validées</span>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-[var(--border)]"
                    role="progressbar"
                    aria-label="Semaines validées"
                    aria-valuemin={0}
                    aria-valuemax={weeks.length}
                    aria-valuenow={validatedCount}
                  >
                    <span
                      className="block h-full bg-[var(--success,#2e7d5b)]"
                      style={{ width: `${(validatedCount / weeks.length) * 100}%` }}
                    />
                  </div>
                  <strong className="text-[14px] text-[var(--primary)]">
                    {validatedCount} / {weeks.length}
                  </strong>
                </div>
              </div>

              {silentTwoWeeks && (
                <div className="journal-alert flex items-center gap-2.5" role="status">
                  <AlertTriangle size={16} aria-hidden="true" />
                  Aucune entrée depuis 2 semaines. Pensez à remplir votre journal.
                </div>
              )}

              <div role="tablist" aria-label="Journal" className="mb-5 flex gap-1 border-b border-[var(--border)]">
                {[
                  { id: "write", label: "Écrire", icon: PenLine },
                  { id: "history", label: "Historique", icon: History },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    id={`journal-tab-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls={`journal-panel-${id}`}
                    onClick={() => setTab(id)}
                    className={`-mb-px inline-flex items-center gap-2 border-0 border-b-2 bg-transparent px-3.5 py-2.5 text-[13px]! font-semibold! cursor-pointer transition-colors active:translate-y-px ${focusRing} ${
                      tab === id
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]"
                    }`}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                    {id === "history" && (
                      <span className={`${chip} ${tone.neutral} px-1.5 py-0.5`}>{data.entries.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {tab === "write" ? (
                <div
                  id="journal-panel-write"
                  role="tabpanel"
                  aria-labelledby="journal-tab-write"
                  className="grid items-start gap-6 md:grid-cols-[300px_minmax(0,1fr)]"
                >
                  <ol className={`${card} m-0 list-none overflow-hidden p-0`} aria-label="Semaines du stage">
                    {weeks.map((week) => {
                      const state = weekState(week, entriesByWeek[week], drafts[week], currentWeek);
                      const isCurrent = week === currentWeek;
                      const isSelected = week === selected;
                      return (
                        <li key={week} className="border-b border-[var(--border)] last:border-b-0">
                          <button
                            type="button"
                            aria-current={isSelected ? "true" : undefined}
                            onClick={() => openWeek(week)}
                            className={`relative flex w-full items-center gap-3 border-0 px-4 py-3 text-left cursor-pointer transition-colors active:translate-y-px ${focusRing} ${
                              isSelected
                                ? "bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--primary)]"
                                : "bg-transparent hover:bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]"
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <strong className="text-[13px] text-[var(--text)]">Semaine {weekNumber(week)}</strong>
                                {isCurrent && (
                                  <span className={`${chip} ${tone.primary} px-1.5 py-0.5 text-[10px]`}>En cours</span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[12px] text-[var(--muted)]">{formatWeekRange(week)}</span>
                              {isCurrent && (
                                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                                  Aujourd’hui · {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                                </span>
                              )}
                            </span>
                            <StateBadge state={state} />
                          </button>
                        </li>
                      );
                    })}
                  </ol>

                  {selected && (
                    <div className={`${card} p-6`}>
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className={sectionTitle}>Semaine {weekNumber(selected)}</h2>
                          <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">{formatWeekRange(selected)}</p>
                        </div>
                        <StateBadge state={weekState(selected, entry, drafts[selected], currentWeek)} />
                      </div>

                      {validated && (
                        <div className={`mb-4 flex flex-col gap-2 rounded-[4px] border px-4 py-3 ${tone.success}`}>
                          <span className="flex items-center gap-2 text-[13px] font-semibold">
                            <CheckCircle2 size={17} aria-hidden="true" />
                            Validée par l’entreprise
                            {entry.validatedAt && <span className="font-normal">le {formatDate(entry.validatedAt)}</span>}
                          </span>
                          {entry.comment && <blockquote className={quote}>{entry.comment}</blockquote>}
                        </div>
                      )}

                      <label htmlFor="journal-content" className="sr-only">
                        Entrée de la semaine {weekNumber(selected)}
                      </label>
                      <textarea
                        id="journal-content"
                        value={content}
                        readOnly={validated}
                        maxLength={MAX_LENGTH}
                        onChange={(event) => {
                          contentRef.current = event.target.value;
                          setContent(event.target.value);
                          setSavedAt(null);
                        }}
                        placeholder="Décrivez vos missions de la semaine, ce que vous avez appris et les difficultés rencontrées."
                        className={`block min-h-[320px] w-full resize-y rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4 text-[14px] leading-[1.65] text-[var(--text)] placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] read-only:cursor-default read-only:bg-[var(--bg)] read-only:hover:border-[var(--border)] ${focusRing}`}
                      />

                      {saveError && (
                        <p role="alert" className="m-0 mt-3 text-[12px] text-[var(--danger)]">
                          {saveError}
                        </p>
                      )}

                      {!validated && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--muted)]">
                            <span aria-live="polite">
                              {content.length} / {MAX_LENGTH}
                            </span>
                            {draftSavedAt && unsaved && (
                              <span className="inline-flex items-center gap-1" aria-live="polite">
                                <Clock3 size={13} aria-hidden="true" />
                                Brouillon enregistré
                              </span>
                            )}
                            {savedAt && (
                              <span className="inline-flex items-center gap-1 text-[var(--success,#2e7d5b)]" aria-live="polite">
                                <Check size={13} aria-hidden="true" />
                                Enregistré à {formatTime(savedAt)}
                              </span>
                            )}
                          </div>
                          <ActionButton
                            loading={saving}
                            disabledReason={!content.trim() ? "Écrivez votre entrée avant de l’enregistrer" : undefined}
                            onClick={save}
                          >
                            {saving ? "Enregistrement…" : entry ? "Mettre à jour" : "Enregistrer"}
                          </ActionButton>
                        </div>
                      )}
                      {!validated && entry && (
                        <p className="m-0 mt-3 text-[12px] text-[var(--muted)]">
                          Modifiable jusqu’à la validation par l’entreprise.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div id="journal-panel-history" role="tabpanel" aria-labelledby="journal-tab-history">
                  {history.length === 0 ? (
                    <EmptyState
                      title="Aucune entrée pour le moment"
                      message="Vos entrées enregistrées apparaîtront ici, de la plus récente à la plus ancienne."
                    />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {history.map((item) => (
                        <article key={item.week} className={`${card} p-5`}>
                          <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className={`${sectionTitle} text-[19px]!`}>Semaine {weekNumber(item.week)}</h3>
                              <p className="m-0 mt-1 text-[12px] text-[var(--muted)]">{formatWeekRange(item.week)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <StateBadge state={weekState(item.week, item, null, currentWeek)} />
                              <span className="text-[11px] text-[var(--muted)]">
                                {item.validated && item.validatedAt
                                  ? `Validée le ${formatDate(item.validatedAt)}`
                                  : `Soumise le ${formatDate(item.submittedAt)}`}
                              </span>
                            </div>
                          </header>
                          <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.65] text-[var(--text)]">{item.content}</p>
                          {item.comment && (
                            <div className="mt-4">
                              <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                                Commentaire de l’entreprise
                              </p>
                              <blockquote className={quote}>{item.comment}</blockquote>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Printed version ("Version PDF"): only the entries, with a header. */}
      <div className="hidden text-[12pt] text-black print:block">
        <header className="mb-6 border-b border-black pb-3">
          <h1 className="m-0 font-['Source_Serif_4',Georgia,serif]! text-[22pt]! leading-tight!">Journal de stage</h1>
          <p className="m-0 mt-2">Étudiant : {studentName}</p>
          {companyName && <p className="m-0">Entreprise : {companyName}</p>}
          <p className="m-0">Période : {periodLabel}</p>
        </header>
        {history.map((item) => (
          <article key={item.week} className="mb-5 break-inside-avoid">
            <h2 className="m-0 font-['Source_Serif_4',Georgia,serif]! text-[14pt]! leading-tight!">
              Semaine {weekNumber(item.week)} · {formatWeekRange(item.week)} ·{" "}
              {STATES[weekState(item.week, item, null, currentWeek)].label}
            </h2>
            <p className="m-0 mt-1.5 whitespace-pre-wrap">{item.content}</p>
            {item.comment && <p className="m-0 mt-1.5 italic">Commentaire de l’entreprise : {item.comment}</p>}
          </article>
        ))}
      </div>

      {toast && <Toast message={toast} onClose={closeToast} />}
    </section>
  );
}
