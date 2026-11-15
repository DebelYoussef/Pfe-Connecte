import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Clock3, MapPin, Pencil, Plus, RotateCw, Search, Users } from "lucide-react";
import { getCompanyOffer, listMyOffers, saveCompanyOffer, setCompanyOfferStatus } from "../../services";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const statusOptions = [
  { value: "ALL", label: "Toutes" },
  { value: "OPEN", label: "Ouvertes" },
  { value: "CLOSED", label: "Fermées" },
  { value: "FILLED", label: "Pourvues" },
];
const statusStyle = {
  OPEN: "bg-primary-tint text-primary",
  CLOSED: "bg-bg text-ink-soft border border-line",
  FILLED: "bg-accent-tint text-accent-ink",
};
const statusLabel = { OPEN: "Ouverte", CLOSED: "Fermée", FILLED: "Pourvue" };

function Badge({ status }) {
  return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span>;
}
function dateLabel(value) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
function ErrorState({ onRetry }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded border border-danger/30 bg-danger-tint p-5 text-sm"><span>Impossible de charger les offres. Réessayez dans un instant.</span><button onClick={onRetry} className={`inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-2 font-medium ${focus}`}><RotateCw className="size-4"/>Réessayer</button></div>;
}

export default function CompanyOffers({ routeMode }) {
  const { id: legacyId, offerId, mode: pathMode } = useParams();
  const id = offerId ?? legacyId;
  const mode = routeMode ?? pathMode;
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [state, setState] = useState("loading");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const isForm = mode === "new" || mode === "edit";

  const load = useCallback(() => {
    if (id && mode !== "new") {
      setState("loading");
      getCompanyOffer(id).then((item) => { setDetail(item); setState("success"); }).catch(() => setState("error"));
    } else {
      setState("loading");
      listMyOffers({ limit: 50 }).then((result) => { setOffers(result.items); setState("success"); }).catch(() => setState("error"));
    }
  }, [id, isForm, refresh]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = id ? `${isForm ? (mode === "new" ? "Nouvelle offre" : "Modifier l’offre") : "Détail de l’offre"} · PFE Connect` : "Mes offres · PFE Connect"; }, [id, isForm, mode]);

  const visibleOffers = useMemo(() => offers.filter((offer) =>
    (filter === "ALL" || offer.status === filter) && offer.title.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")),
  ), [offers, filter, query]);
  const stats = useMemo(() => ({ all: offers.length, open: offers.filter((o) => o.status === "OPEN").length, applications: offers.reduce((n, o) => n + o.applicationsCount, 0) }), [offers]);

  async function changeStatus(status) {
    if (!detail) return;
    setSaving(true);
    try { const updated = await setCompanyOfferStatus(detail.id, status); setDetail(updated); setRefresh((n) => n + 1); }
    catch { setFormError("Le statut n’a pas pu être modifié."); }
    finally { setSaving(false); }
  }
  async function submitOffer(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const location = String(data.get("location") ?? "").trim();
    const duration = String(data.get("duration") ?? "").trim();
    if (!title || !description || !location || !duration) { setFormError("Complétez tous les champs obligatoires."); return; }
    setSaving(true); setFormError("");
    try {
      const saved = await saveCompanyOffer({ title, description, location, duration }, mode === "edit" ? id : undefined);
      navigate(`/company/offres/${saved.id}`, { replace: true });
    } catch { setFormError("L’offre n’a pas pu être enregistrée."); }
    finally { setSaving(false); }
  }

  if (isForm) return (
    <div className="mx-auto max-w-3xl">
      <Link to={mode === "edit" ? `/company/offres/${id}` : "/company/offres"} className={`mb-8 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-primary ${focus}`}><ArrowLeft className="size-4"/>Retour aux offres</Link>
      <div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">Espace entreprise</p><h1 className="font-serif text-4xl font-semibold tracking-tight">{mode === "new" ? "Publier une offre" : "Modifier l’offre"}</h1><p className="mt-3 text-ink-soft">Présentez clairement le stage pour aider les étudiants à se projeter.</p></div>
      {mode === "edit" && state === "loading" ? <div className="h-80 animate-pulse rounded bg-skeleton"/> : <form key={detail?.id ?? "new-offer"} onSubmit={submitOffer} className="flex flex-col gap-6 rounded border border-line bg-surface p-5 sm:p-8">
        <label className="grid gap-2 text-sm font-medium">Intitulé du poste <span className="text-danger">*</span><input required name="title" defaultValue={detail?.title ?? ""} placeholder="Ex. Développeur Front-end React" className={`rounded border border-line bg-bg px-4 py-3 font-normal text-ink placeholder:text-ink-soft ${focus}`}/></label>
        <div className="grid gap-6 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Lieu du stage <span className="text-danger">*</span><input required name="location" defaultValue={detail?.location ?? ""} placeholder="Ex. Tunis, hybride" className={`rounded border border-line bg-bg px-4 py-3 font-normal text-ink placeholder:text-ink-soft ${focus}`}/></label><label className="grid gap-2 text-sm font-medium">Durée <span className="text-danger">*</span><input required name="duration" defaultValue={detail?.duration ?? ""} placeholder="Ex. 4 à 6 mois" className={`rounded border border-line bg-bg px-4 py-3 font-normal text-ink placeholder:text-ink-soft ${focus}`}/></label></div>
        <label className="grid gap-2 text-sm font-medium">Description et missions <span className="text-danger">*</span><textarea required name="description" rows={7} defaultValue={detail?.description ?? ""} placeholder="Décrivez les missions, les compétences recherchées et l’équipe…" className={`resize-y rounded border border-line bg-bg px-4 py-3 font-normal leading-relaxed text-ink placeholder:text-ink-soft ${focus}`}/></label>
        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5"><Link to={mode === "edit" ? `/company/offres/${id}` : "/company/offres"} className={`rounded border border-line px-5 py-3 text-sm font-semibold hover:bg-bg ${focus}`}>Annuler</Link><button disabled={saving} className={`inline-flex items-center gap-2 rounded bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-50 ${focus}`}>{saving ? "Enregistrement…" : <>{mode === "new" ? "Publier l’offre" : "Enregistrer"}<ArrowUpRight className="size-4"/></>}</button></div>
      </form>}
    </div>
  );

  if (id) return <div className="mx-auto max-w-4xl">{state === "loading" ? <div className="h-96 animate-pulse rounded bg-skeleton"/> : state === "error" ? <ErrorState onRetry={() => setRefresh((n) => n + 1)}/> : !detail ? <div className="rounded border border-line bg-surface p-10 text-center"><h1 className="font-serif text-3xl">Offre introuvable</h1><Link to="/company/offres" className="mt-5 inline-block text-primary underline">Retour aux offres</Link></div> : <>
    <Link to="/company/offres" className={`mb-8 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-primary ${focus}`}><ArrowLeft className="size-4"/>Toutes les offres</Link>
    <section className="rounded bg-hero p-6 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-4 text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">Offre de stage</p><h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{detail.title}</h1><div className="mt-5 flex flex-wrap gap-4 text-sm text-ink-soft"><span className="inline-flex items-center gap-2"><MapPin className="size-4"/>{detail.location || "Lieu à préciser"}</span><span className="inline-flex items-center gap-2"><Clock3 className="size-4"/>{detail.duration || "Durée à préciser"}</span><span className="inline-flex items-center gap-2"><CalendarDays className="size-4"/>Publiée le {dateLabel(detail.createdAt)}</span></div></div><Badge status={detail.status}/></div><div className="mt-8 flex flex-wrap gap-3"><Link to={`/company/offres/${id}/modifier`} className={`inline-flex items-center gap-2 rounded bg-primary px-5 py-3 text-sm font-semibold text-on-primary ${focus}`}><Pencil className="size-4"/>Modifier l’offre</Link>{detail.status === "OPEN" ? <button disabled={saving} onClick={() => changeStatus("CLOSED")} className={`rounded border border-line bg-surface px-5 py-3 text-sm font-semibold hover:bg-bg disabled:opacity-50 ${focus}`}>Fermer l’offre</button> : <button disabled={saving} onClick={() => changeStatus("OPEN")} className={`rounded border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary-tint disabled:opacity-50 ${focus}`}>Réouvrir l’offre</button>}</div></section>
    {formError && <p role="alert" className="mt-4 text-sm text-danger">{formError}</p>}
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]"><section className="rounded border border-line bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl font-semibold">À propos du stage</h2><p className="mt-5 whitespace-pre-line text-[15px] leading-7 text-ink-soft">{detail.description || "Aucune description renseignée pour cette offre."}</p></section><aside className="flex flex-col gap-4"><div className="rounded border border-line bg-surface p-6"><p className="text-sm text-ink-soft">Candidatures reçues</p><p className="mt-2 font-serif text-4xl font-semibold">{detail.applicationsCount}</p><Link to={`/company/candidatures?offer=${detail.id}`} className={`mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline ${focus}`}>Voir les candidatures<ChevronRight className="size-4"/></Link></div><div className="rounded border border-line bg-surface p-6"><p className="font-semibold">Visibilité</p><p className="mt-2 text-sm leading-6 text-ink-soft">{detail.status === "OPEN" ? "Cette offre est visible par les étudiants." : "Cette offre n’est pas proposée aux nouvelles candidatures."}</p></div></aside></div>
  </>}</div>;

  return <div className="flex flex-col gap-8">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">Espace entreprise</p><h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Mes offres</h1><p className="mt-3 text-ink-soft">Gérez vos offres et suivez les candidatures reçues.</p></div><Link to="/company/offres/nouvelle" className={`inline-flex items-center gap-2 rounded bg-primary px-5 py-3.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 ${focus}`}><Plus className="size-4"/>Publier une offre</Link></div>
    {state === "loading" ? <div className="grid gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse rounded bg-skeleton"/><div className="h-28 animate-pulse rounded bg-skeleton"/><div className="h-28 animate-pulse rounded bg-skeleton"/></div> : state === "error" ? <ErrorState onRetry={() => setRefresh((n) => n + 1)}/> : <>
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded border border-line bg-surface p-5"><p className="text-sm text-ink-soft">Toutes les offres</p><p className="mt-2 font-serif text-3xl font-semibold">{stats.all}</p></div><div className="rounded border border-line bg-surface p-5"><p className="text-sm text-ink-soft">Offres ouvertes</p><p className="mt-2 font-serif text-3xl font-semibold text-primary">{stats.open}</p></div><div className="rounded border border-line bg-surface p-5"><p className="text-sm text-ink-soft">Candidatures reçues</p><p className="mt-2 font-serif text-3xl font-semibold">{stats.applications}</p></div></div>
      <div className="flex flex-col gap-5 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between"><div role="tablist" aria-label="Filtrer les offres" className="flex flex-wrap gap-2">{statusOptions.map((option) => <button key={option.value} role="tab" aria-selected={filter === option.value} onClick={() => setFilter(option.value)} className={`rounded px-4 py-2 text-sm font-medium transition-colors ${focus} ${filter === option.value ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-soft hover:text-ink"}`}>{option.label}{option.value === "ALL" ? ` · ${stats.all}` : option.value === "OPEN" ? ` · ${stats.open}` : ""}</button>)}</div><label className="relative block w-full sm:max-w-xs"><span className="sr-only">Rechercher une offre</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une offre" className={`w-full rounded border border-line bg-surface py-2.5 pl-10 pr-3 text-sm placeholder:text-ink-soft ${focus}`}/></label></div>
      {visibleOffers.length === 0 ? <div className="rounded border border-dashed border-line bg-surface px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded bg-primary-tint text-primary"><BriefcaseBusiness className="size-5"/></span><h2 className="mt-4 font-serif text-2xl font-semibold">{query ? "Aucun résultat" : filter === "ALL" ? "Aucune offre publiée" : "Aucune offre dans cette catégorie"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">{query ? "Essayez un autre intitulé ou modifiez les filtres." : "Publiez une offre de stage pour commencer à recevoir des candidatures."}</p>{!query && filter === "ALL" && <Link to="/company/offres/nouvelle" className={`mt-5 inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary ${focus}`}><Plus className="size-4"/>Publier une offre</Link>}</div> : <div className="grid gap-4 xl:grid-cols-2">{visibleOffers.map((offer) => <article key={offer.id} className="group rounded border border-line bg-surface p-5 transition-shadow hover:shadow-sm sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><Badge status={offer.status}/><h2 className="mt-3 font-serif text-2xl font-semibold leading-tight"><Link to={`/company/offres/${offer.id}`} className={`rounded hover:text-primary ${focus}`}>{offer.title}</Link></h2></div><Link to={`/company/offres/${offer.id}/modifier`} aria-label={`Modifier ${offer.title}`} className={`grid size-9 shrink-0 place-items-center rounded text-ink-soft hover:bg-primary-tint hover:text-primary ${focus}`}><Pencil className="size-4"/></Link></div><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft"><span className="inline-flex items-center gap-2"><Users className="size-4"/>{offer.applicationsCount} candidatures</span><span className="inline-flex items-center gap-2"><CalendarDays className="size-4"/>Publiée le {dateLabel(offer.createdAt)}</span></div><div className="mt-5 flex items-center justify-between border-t border-line pt-4"><span className="text-xs text-ink-soft">{offer.status === "OPEN" ? "Visible par les étudiants" : offer.status === "FILLED" ? "Poste pourvu" : "Offre clôturée"}</span><Link to={`/company/offres/${offer.id}`} className={`inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline ${focus}`}>Détails<ChevronRight className="size-4"/></Link></div></article>)}</div>}
    </>}
  </div>;
}
