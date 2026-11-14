import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, CircleUserRound, FileCheck2, Mail, MapPin, RotateCw, Search, SlidersHorizontal } from "lucide-react";
import { getCompanyApplication, listCompanyApplications, listMyOffers, updateCompanyApplicationStatus } from "../../services";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const filters = [
  { value: "ALL", label: "Toutes" },
  { value: "PENDING", label: "En attente" },
  { value: "VIEWED", label: "Consultées" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "ACCEPTED", label: "Acceptées" },
];
const statuses = {
  PENDING: { label: "En attente", styles: "bg-accent-tint text-accent-ink" },
  VIEWED: { label: "Consultée", styles: "border border-line bg-bg text-ink-soft" },
  IN_PROGRESS: { label: "En cours", styles: "bg-primary-tint text-primary" },
  ACCEPTED: { label: "Acceptée", styles: "bg-primary text-on-primary" },
  REJECTED: { label: "Refusée", styles: "bg-danger-tint text-danger" },
};
const dateLabel = (value) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
function Badge({ status }) { const item = statuses[status] ?? statuses.PENDING; return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${item.styles}`}>{item.label}</span>; }
function initials(name) { return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function ErrorState({ onRetry }) { return <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded border border-danger/30 bg-danger-tint p-5 text-sm"><span>Impossible de charger les candidatures. Réessayez dans un instant.</span><button onClick={onRetry} className={`inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-2 font-medium ${focus}`}><RotateCw className="size-4"/>Réessayer</button></div>; }

export default function CompanyApplications() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [offers, setOffers] = useState([]);
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState(searchParams.get("status") ?? "ALL");
  const [offerFilter, setOfferFilter] = useState(searchParams.get("offer") ?? "ALL");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const load = useCallback(() => {
    setStatus("loading");
    if (id) {
      getCompanyApplication(id).then((application) => { setDetail(application); setStatus("success"); }).catch(() => setStatus("error"));
    } else {
      Promise.all([listCompanyApplications({ limit: 50 }), listMyOffers({ limit: 50 })])
        .then(([applicationPage, offerPage]) => { setApplications(applicationPage.items); setOffers(offerPage.items); setStatus("success"); })
        .catch(() => setStatus("error"));
    }
  }, [id, refresh]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = id ? "Détail de la candidature · PFE Connect" : "Candidatures · PFE Connect"; }, [id]);
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    query ? next.set("q", query) : next.delete("q");
    filter !== "ALL" ? next.set("status", filter) : next.delete("status");
    offerFilter !== "ALL" ? next.set("offer", offerFilter) : next.delete("offer");
    setSearchParams(next, { replace: true });
  }, [query, filter, offerFilter]);

  const counts = useMemo(() => Object.fromEntries(filters.map(({ value }) => [value, value === "ALL" ? applications.length : applications.filter((item) => item.status === value).length])), [applications]);
  const visible = useMemo(() => applications.filter((app) => {
    const matchesFilter = filter === "ALL" || app.status === filter;
    const matchesOffer = offerFilter === "ALL" || app.offerId === offerFilter;
    const search = `${app.studentName} ${app.offerTitle}`.toLocaleLowerCase("fr");
    return matchesFilter && matchesOffer && search.includes(query.toLocaleLowerCase("fr"));
  }), [applications, filter, offerFilter, query]);

  async function changeStatus(nextStatus) {
    if (!detail) return;
    setBusy(true); setActionError("");
    try { const updated = await updateCompanyApplicationStatus(detail.id, nextStatus); setDetail(updated); setRefresh((n) => n + 1); }
    catch { setActionError("Le statut n’a pas pu être mis à jour."); }
    finally { setBusy(false); }
  }

  if (id) return <div className="mx-auto max-w-4xl">
    <Link to="/company/applications" className={`mb-8 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-primary ${focus}`}><ArrowLeft className="size-4"/>Toutes les candidatures</Link>
    {status === "loading" ? <div className="h-96 animate-pulse rounded bg-skeleton"/> : status === "error" ? <ErrorState onRetry={() => setRefresh((n) => n + 1)}/> : !detail ? <div className="rounded border border-line bg-surface p-10 text-center"><h1 className="font-serif text-3xl">Candidature introuvable</h1><Link to="/company/applications" className="mt-5 inline-block text-primary underline">Retour aux candidatures</Link></div> : <>
      <section className="rounded bg-hero p-6 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded bg-primary text-sm font-semibold text-on-primary">{initials(detail.studentName)}</span><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">Candidature reçue</p><h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{detail.studentName}</h1></div></div><Badge status={detail.status}/></div><p className="mt-6 text-lg text-ink-soft">Candidature pour <Link to={`/company/offers/${detail.offerId}`} className={`font-semibold text-primary hover:underline ${focus}`}>{detail.offerTitle}</Link></p><p className="mt-2 inline-flex items-center gap-2 text-sm text-ink-soft"><CalendarDays className="size-4"/>Reçue le {dateLabel(detail.createdAt)}</p></section>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]"><section className="rounded border border-line bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl font-semibold">Profil du candidat</h2><div className="mt-6 grid gap-5 sm:grid-cols-2"><div className="flex gap-3"><CircleUserRound className="mt-0.5 size-5 text-primary"/><div><p className="text-sm font-medium">Étudiant</p><p className="mt-1 text-sm text-ink-soft">{detail.studentName}</p></div></div><div className="flex gap-3"><FileCheck2 className="mt-0.5 size-5 text-primary"/><div><p className="text-sm font-medium">Offre concernée</p><p className="mt-1 text-sm text-ink-soft">{detail.offerTitle}</p></div></div><div className="flex gap-3"><CalendarDays className="mt-0.5 size-5 text-primary"/><div><p className="text-sm font-medium">Date de candidature</p><p className="mt-1 text-sm text-ink-soft">{dateLabel(detail.createdAt)}</p></div></div><div className="flex gap-3"><MapPin className="mt-0.5 size-5 text-primary"/><div><p className="text-sm font-medium">Statut</p><p className="mt-1 text-sm text-ink-soft">{statuses[detail.status]?.label ?? "À examiner"}</p></div></div></div><div className="mt-8 border-t border-line pt-6"><h3 className="font-serif text-xl font-semibold">Prochaine étape</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Consultez le profil de l’étudiant, puis faites évoluer le statut pour suivre votre processus de sélection.</p></div></section>
      <aside className="h-fit rounded border border-line bg-surface p-6"><h2 className="font-serif text-xl font-semibold">Gérer la candidature</h2><p className="mt-2 text-sm leading-6 text-ink-soft">Mettez à jour le statut selon l’avancement de votre échange.</p><div className="mt-5 flex flex-col gap-2">{detail.status !== "IN_PROGRESS" && <button disabled={busy} onClick={() => changeStatus("IN_PROGRESS")} className={`rounded border border-primary px-4 py-3 text-sm font-semibold text-primary hover:bg-primary-tint disabled:opacity-50 ${focus}`}>Passer en cours</button>}{detail.status !== "ACCEPTED" && <button disabled={busy} onClick={() => changeStatus("ACCEPTED")} className={`inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-50 ${focus}`}>Accepter la candidature<ArrowUpRight className="size-4"/></button>}{detail.status !== "REJECTED" && <button disabled={busy} onClick={() => changeStatus("REJECTED")} className={`rounded border border-line px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-bg disabled:opacity-50 ${focus}`}>Refuser la candidature</button>}{actionError && <p role="alert" className="mt-2 text-sm text-danger">{actionError}</p>}</div></aside></div>
    </>}
  </div>;

  return <div className="flex flex-col gap-8">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">Espace entreprise</p><h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Candidatures</h1><p className="mt-3 text-ink-soft">Examinez les profils et suivez chaque étape de recrutement.</p></div><div className="rounded bg-hero px-5 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">À examiner</p><p className="mt-1 font-serif text-2xl font-semibold">{counts.PENDING + counts.VIEWED}</p></div></header>
    {status === "loading" ? <div className="space-y-4"><div className="h-12 animate-pulse rounded bg-skeleton"/><div className="h-72 animate-pulse rounded bg-skeleton"/></div> : status === "error" ? <ErrorState onRetry={() => setRefresh((n) => n + 1)}/> : <>
      <div role="tablist" aria-label="Filtrer par statut" className="flex gap-2 overflow-x-auto border-b border-line pb-3">{filters.map((item) => <button key={item.value} role="tab" aria-selected={filter === item.value} onClick={() => setFilter(item.value)} className={`shrink-0 rounded px-3.5 py-2 text-sm font-medium ${focus} ${filter === item.value ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-soft hover:text-ink"}`}>{item.label}<span className="ml-2 tabular-nums opacity-75">{counts[item.value]}</span></button>)}</div>
      <div className="flex flex-col gap-3 rounded border border-line bg-surface p-4 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Rechercher un candidat ou une offre</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un candidat ou une offre" className={`w-full rounded border border-line bg-bg py-2.5 pl-10 pr-3 text-sm placeholder:text-ink-soft ${focus}`}/></label><label className="relative sm:w-72"><span className="sr-only">Filtrer par offre</span><SlidersHorizontal className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"/><select value={offerFilter} onChange={(e) => setOfferFilter(e.target.value)} className={`w-full appearance-none rounded border border-line bg-bg py-2.5 pl-10 pr-4 text-sm text-ink ${focus}`}><option value="ALL">Toutes les offres</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}</select></label></div>
      {visible.length === 0 ? <div className="rounded border border-dashed border-line bg-surface px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded bg-primary-tint text-primary"><FileCheck2 className="size-5"/></span><h2 className="mt-4 font-serif text-2xl font-semibold">{applications.length ? "Aucun résultat" : "Aucune candidature reçue"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">{applications.length ? "Modifiez votre recherche ou vos filtres." : "Les candidatures des étudiants apparaîtront ici dès qu’une offre sera publiée."}</p>{!applications.length && <Link to="/company/offers/new" className={`mt-5 inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary ${focus}`}>Publier une offre<ArrowUpRight className="size-4"/></Link>}</div> : <div className="overflow-hidden rounded border border-line bg-surface"><div className="hidden grid-cols-[minmax(12rem,1.2fr)_minmax(12rem,1.5fr)_8rem_8rem_2rem] gap-4 border-b border-line bg-bg px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-soft md:grid"><span>Candidat</span><span>Offre</span><span>Reçue le</span><span>Statut</span><span/></div><ul className="divide-y divide-line">{visible.map((app) => <li key={app.id}><Link to={`/company/applications/${app.id}`} className={`grid gap-3 px-4 py-4 transition-colors hover:bg-bg/70 sm:px-5 md:grid-cols-[minmax(12rem,1.2fr)_minmax(12rem,1.5fr)_8rem_8rem_2rem] md:items-center md:gap-4 ${focus}`}><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded bg-primary-tint text-xs font-bold text-primary">{initials(app.studentName)}</span><span className="min-w-0"><span className="block truncate font-semibold text-ink">{app.studentName}</span><span className="mt-0.5 block text-xs text-ink-soft md:hidden">{app.offerTitle}</span></span></div><span className="hidden truncate text-sm text-ink-soft md:block">{app.offerTitle}</span><time dateTime={app.createdAt} className="text-xs text-ink-soft">{dateLabel(app.createdAt)}</time><span><Badge status={app.status}/></span><ChevronRight className="hidden size-4 text-ink-soft md:block"/></Link></li>)}</ul><div className="border-t border-line px-5 py-3 text-xs text-ink-soft">{visible.length} candidature{visible.length > 1 ? "s" : ""} affichée{visible.length > 1 ? "s" : ""}</div></div>}
    </>}
  </div>;
}
