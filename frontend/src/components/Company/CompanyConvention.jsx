import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, FileSignature, UserRound, Users } from "lucide-react";
import { getCompanyConvention, listCompanyConventions, updateCompanyConventionStatus } from "../../services";
import { EmptyPanel, formatDate, LoadError, LoadingRows, MetricCard, PageHeading, PersonAvatar, StatusTag, focusRing } from "./WorkflowUI";

const filters = [{ id: "ALL", label: "Toutes" }, { id: "TO_SIGN", label: "À signer" }, { id: "IN_PROGRESS", label: "En cours" }, { id: "SIGNED", label: "Signées" }];

export default function CompanyConventions() {
  const { id: legacyId, conventionId } = useParams();
  const id = conventionId ?? legacyId;
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");
  const load = useCallback(() => {
    setState("loading");
    const request = id ? getCompanyConvention(id).then(setSelected) : listCompanyConventions({ limit: 50 }).then((result) => setItems(result.items));
    request.then(() => setState("success")).catch(() => setState("error"));
  }, [id, refresh]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = id ? "Détail de la convention · PFE Connect" : "Conventions · PFE Connect"; }, [id]);
  const visible = useMemo(() => items.filter((item) => filter === "ALL" || item.status === filter), [items, filter]);
  const counts = useMemo(() => ({ all: items.length, sign: items.filter((item) => item.status === "TO_SIGN").length, signed: items.filter((item) => item.status === "SIGNED").length }), [items]);

  async function signConvention() {
    if (!selected) return;
    setBusy(true); setNotice("");
    try { const updated = await updateCompanyConventionStatus(selected.id, "SIGNED"); setSelected(updated); setNotice("La convention est marquée comme signée."); }
    catch { setNotice("La signature n’a pas pu être enregistrée."); }
    finally { setBusy(false); }
  }

  if (id) return <div className="mx-auto max-w-4xl"><Link to="/company/conventions" className={`mb-7 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-primary ${focusRing}`}><ArrowLeft className="size-4"/>Toutes les conventions</Link>{state === "loading" ? <LoadingRows count={2}/> : state === "error" ? <LoadError onRetry={() => setRefresh((n) => n + 1)}/> : !selected ? <EmptyPanel title="Convention introuvable" description="Cette convention n’est peut-être plus disponible." icon={FileSignature}/> : <>
    <section className="rounded bg-hero p-6 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-4"><PersonAvatar name={selected.studentName}/><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">Convention de stage</p><h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">{selected.studentName}</h1></div></div><StatusTag status={selected.status}/></div><p className="mt-5 text-ink-soft">Stage : <Link to="/company/offres" className={`font-semibold text-primary hover:underline ${focusRing}`}>{selected.offerTitle}</Link></p><div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-soft"><span className="inline-flex items-center gap-2"><CalendarDays className="size-4"/>Du {formatDate(selected.startDate, { day: "numeric", month: "short", year: "numeric" })} au {formatDate(selected.endDate, { day: "numeric", month: "short", year: "numeric" })}</span><span className="inline-flex items-center gap-2"><UserRound className="size-4"/>Tuteur : {selected.tutorName}</span></div></section>
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_19rem]"><section className="rounded border border-line bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl font-semibold">Détails de la convention</h2><dl className="mt-6 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Étudiant</dt><dd className="mt-1 font-medium">{selected.studentName}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Entreprise</dt><dd className="mt-1 font-medium">Atelier Digital</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Période</dt><dd className="mt-1 font-medium">{formatDate(selected.startDate)} – {formatDate(selected.endDate)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Encadrant entreprise</dt><dd className="mt-1 font-medium">{selected.tutorName}</dd></div></dl><div className="mt-7 border-t border-line pt-6"><h3 className="font-semibold">Notes</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{selected.notes}</p></div></section>
    <aside className="h-fit rounded border border-line bg-surface p-6"><h2 className="font-serif text-xl font-semibold">Signature</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{selected.status === "SIGNED" ? "Votre signature a été enregistrée. La convention est consultable par toutes les parties." : selected.status === "TO_SIGN" ? "Vérifiez les informations de la convention avant de confirmer la signature de l’entreprise." : "La convention suit son circuit de validation."}</p>{selected.status === "TO_SIGN" && <button disabled={busy} onClick={signConvention} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-50 ${focusRing}`}>{busy ? "Enregistrement…" : <><Check className="size-4"/>Signer la convention</>}</button>}{notice && <p role="status" className="mt-3 text-sm text-primary">{notice}</p>}</aside></div>
    </>}</div>;

  return <div className="flex flex-col gap-8"><PageHeading title="Conventions" description="Suivez les conventions de stage et les signatures des différentes parties." action={<Link to="/company/candidatures" className={`inline-flex items-center gap-2 rounded border border-line bg-surface px-4 py-3 text-sm font-semibold hover:bg-bg ${focusRing}`}><Users className="size-4"/>Candidatures</Link>}/>
    {state === "loading" ? <LoadingRows count={3}/> : state === "error" ? <LoadError onRetry={() => setRefresh((n) => n + 1)}/> : <><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Total conventions" value={counts.all}/><MetricCard label="À signer" value={counts.sign} note="Action requise"/><MetricCard label="Signées" value={counts.signed}/></div><div role="tablist" aria-label="Filtrer les conventions" className="flex gap-2 overflow-x-auto border-b border-line pb-3">{filters.map((item) => <button key={item.id} role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded px-4 py-2 text-sm font-medium ${focusRing} ${filter === item.id ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-soft hover:text-ink"}`}>{item.label}{item.id === "ALL" ? ` · ${counts.all}` : item.id === "TO_SIGN" ? ` · ${counts.sign}` : item.id === "SIGNED" ? ` · ${counts.signed}` : ""}</button>)}</div>
    {visible.length ? <div className="grid gap-4 xl:grid-cols-2">{visible.map((item) => <article key={item.id} className="rounded border border-line bg-surface p-5 sm:p-6"><div className="flex items-start gap-4"><PersonAvatar name={item.studentName}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{item.studentName}</h2><StatusTag status={item.status}/></div><p className="mt-1 truncate text-sm text-ink-soft">{item.offerTitle}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5"/>{formatDate(item.startDate, { day: "numeric", month: "short" })} – {formatDate(item.endDate, { day: "numeric", month: "short", year: "numeric" })}</span><span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5"/>Tuteur : {item.tutorName}</span></div><div className="mt-5 flex items-center justify-between border-t border-line pt-4"><span className="text-xs text-ink-soft">Mise à jour le {formatDate(item.createdAt, { day: "numeric", month: "short" })}</span><Link to={`/company/conventions/${item.id}`} className={`inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline ${focusRing}`}>{item.status === "TO_SIGN" ? "Signer" : "Voir la convention"}<ArrowUpRight className="size-4"/></Link></div></div></div></article>)}</div> : <EmptyPanel title="Aucune convention dans cette catégorie" description="Les conventions apparaîtront ici à mesure que les stages sont confirmés." icon={FileSignature} action={<Link to="/company/candidatures" className={`inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary ${focusRing}`}>Voir les candidatures</Link>}/>}</>}
  </div>;
}
