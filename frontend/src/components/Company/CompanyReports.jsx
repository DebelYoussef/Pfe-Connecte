import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, Check, FileText, MessageSquareText } from "lucide-react";
import { getCompanyReport, listCompanyReports, reviewCompanyReport } from "../../services";
import { EmptyPanel, formatDate, LoadError, LoadingRows, MetricCard, PageHeading, PersonAvatar, StatusTag, focusRing } from "../../components/WorkflowUI";

const filters = [{ id: "ALL", label: "Tous" }, { id: "TO_REVIEW", label: "À examiner" }, { id: "APPROVED", label: "Validés" }, { id: "REVISION", label: "À corriger" }];
const typeLabel = { INTERMEDIATE: "Rapport intermédiaire", WEEKLY: "Rapport de suivi", FINAL: "Rapport final" };

export default function CompanyReports() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setState("loading");
    const request = id ? getCompanyReport(id).then((item) => { setSelected(item); setFeedback(item?.feedback ?? ""); }) : listCompanyReports({ limit: 50 }).then((result) => setItems(result.items));
    request.then(() => setState("success")).catch(() => setState("error"));
  }, [id, refresh]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = id ? "Rapport de stage · PFE Connect" : "Rapports de stage · PFE Connect"; }, [id]);

  const visible = useMemo(() => items.filter((item) => filter === "ALL" || item.status === filter), [items, filter]);
  const pending = items.filter((item) => item.status === "TO_REVIEW").length;
  const approved = items.filter((item) => item.status === "APPROVED").length;

  async function update(status) {
    if (!selected) return;
    if (status === "REVISION" && !feedback.trim()) { setError("Ajoutez un commentaire pour demander une correction."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await reviewCompanyReport(selected.id, status, feedback.trim());
      setSelected(updated); setNotice(status === "APPROVED" ? "Le rapport a été validé." : "Votre demande de correction a été envoyée.");
    } catch { setError("La mise à jour n’a pas pu être enregistrée."); }
    finally { setBusy(false); }
  }

  if (id) return <div className="mx-auto max-w-4xl"><Link to="/company/reports" className={`mb-7 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-primary ${focusRing}`}><ArrowLeft className="size-4"/>Tous les rapports</Link>{state === "loading" ? <LoadingRows count={2}/> : state === "error" ? <LoadError onRetry={() => setRefresh((n) => n + 1)}/> : !selected ? <EmptyPanel title="Rapport introuvable" description="Ce rapport n’est peut-être plus disponible." icon={FileText}/> : <>
    <section className="rounded bg-hero p-6 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-4"><PersonAvatar name={selected.studentName}/><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">{typeLabel[selected.type] ?? "Rapport de stage"}</p><h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">{selected.title}</h1></div></div><StatusTag status={selected.status}/></div><p className="mt-5 text-ink-soft">{selected.studentName} <span aria-hidden="true">·</span> {selected.offerTitle}</p><p className="mt-2 inline-flex items-center gap-2 text-sm text-ink-soft"><CalendarDays className="size-4"/>Soumis le {formatDate(selected.submittedAt)}</p></section>
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]"><section className="rounded border border-line bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl font-semibold">Résumé du rapport</h2><p className="mt-5 whitespace-pre-line text-[15px] leading-7 text-ink-soft">{selected.summary}</p><div className="mt-8 rounded bg-bg p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Progression du stage</h3><span className="font-serif text-xl font-semibold text-primary">{selected.progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{ width: `${selected.progress}%`}}/></div><p className="mt-2 text-xs text-ink-soft">Avancement communiqué par le stagiaire</p></div></section>
    <aside className="h-fit rounded border border-line bg-surface p-6"><h2 className="font-serif text-xl font-semibold">Évaluation</h2><p className="mt-2 text-sm leading-6 text-ink-soft">Partagez vos commentaires sur le travail et la progression présentés.</p><label className="mt-4 grid gap-2 text-sm font-medium" htmlFor="report-feedback">Commentaire<textarea id="report-feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder="Votre retour sur le rapport…" className={`resize-y rounded border border-line bg-bg px-3 py-2.5 text-sm font-normal leading-6 placeholder:text-ink-soft ${focusRing}`}/></label>{selected.feedback && <p className="mt-3 rounded bg-bg p-3 text-sm text-ink-soft">Dernier retour : {selected.feedback}</p>}{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-primary">{notice}</p>}{selected.status === "TO_REVIEW" || selected.status === "REVISION" ? <div className="mt-4 flex flex-col gap-2"><button disabled={busy} onClick={() => update("APPROVED")} className={`inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-50 ${focusRing}`}>{busy ? "Enregistrement…" : <><Check className="size-4"/>Valider le rapport</>}</button><button disabled={busy} onClick={() => update("REVISION")} className={`inline-flex items-center justify-center gap-2 rounded border border-line px-4 py-3 text-sm font-semibold hover:bg-bg disabled:opacity-50 ${focusRing}`}><MessageSquareText className="size-4"/>Demander une correction</button></div> : <p className="mt-4 text-sm text-ink-soft">Ce rapport a déjà été traité.</p>}</aside></div>
    </>}</div>;

  return <div className="flex flex-col gap-8"><PageHeading title="Rapports de stage" description="Consultez les rapports remis par les stagiaires et donnez votre avis sur leur avancement." action={pending > 0 && <span className="inline-flex items-center gap-2 rounded bg-accent-tint px-4 py-3 text-sm font-semibold text-accent-ink"><FileText className="size-4"/>{pending} à examiner</span>}/>
    {state === "loading" ? <LoadingRows count={3}/> : state === "error" ? <LoadError onRetry={() => setRefresh((n) => n + 1)}/> : <><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Rapports reçus" value={items.length}/><MetricCard label="À examiner" value={pending} note="En attente de votre avis"/><MetricCard label="Validés" value={approved}/></div><div role="tablist" aria-label="Filtrer les rapports" className="flex gap-2 overflow-x-auto border-b border-line pb-3">{filters.map((item) => <button key={item.id} role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded px-4 py-2 text-sm font-medium ${focusRing} ${filter === item.id ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-soft hover:text-ink"}`}>{item.label}{item.id === "ALL" ? ` · ${items.length}` : item.id === "TO_REVIEW" ? ` · ${pending}` : ""}</button>)}</div>
    {visible.length ? <div className="grid gap-4 xl:grid-cols-2">{visible.map((item) => <article key={item.id} className="rounded border border-line bg-surface p-5 sm:p-6"><div className="flex items-start gap-4"><PersonAvatar name={item.studentName}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-accent-ink">{typeLabel[item.type] ?? "Rapport"}</span><StatusTag status={item.status}/></div><h2 className="mt-2 font-serif text-xl font-semibold leading-snug">{item.title}</h2><p className="mt-1 text-sm text-ink-soft">{item.studentName} <span aria-hidden="true">·</span> {item.offerTitle}</p><p className="mt-4 line-clamp-2 text-sm leading-6 text-ink-soft">{item.summary}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><span className="text-xs text-ink-soft">Reçu le {formatDate(item.submittedAt, { day: "numeric", month: "short" })}</span><Link to={`/company/reports/${item.id}`} className={`inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline ${focusRing}`}>{item.status === "TO_REVIEW" ? "Examiner" : "Consulter"}<ArrowUpRight className="size-4"/></Link></div></div></div></article>)}</div> : <EmptyPanel title="Aucun rapport dans cette catégorie" description="Les rapports remis par vos stagiaires apparaîtront ici." icon={BarChart3}/>}</>}
  </div>;
}
