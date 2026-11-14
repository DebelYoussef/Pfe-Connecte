import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, BriefcaseBusiness, CheckCheck, ChevronRight, FileCheck2, FileSignature, FileText, Search } from "lucide-react";
import { listCompanyNotifications, markAllCompanyNotificationsRead, markCompanyNotificationRead } from "../../services";
import { EmptyPanel, formatDate, LoadError, LoadingRows, MetricCard, PageHeading, focusRing } from "../../components/WorkflowUI";

const category = {
  APPLICATION: { label: "Candidature", icon: FileCheck2, styles: "bg-primary-tint text-primary" },
  CONVENTION: { label: "Convention", icon: FileSignature, styles: "bg-accent-tint text-accent-ink" },
  JOURNAL: { label: "Journal", icon: FileText, styles: "bg-primary-tint text-primary" },
  REPORT: { label: "Rapport", icon: FileText, styles: "bg-bg text-ink-soft" },
  OFFER: { label: "Offre", icon: BriefcaseBusiness, styles: "bg-bg text-ink-soft" },
};
const filters = [{ id: "ALL", label: "Toutes" }, { id: "UNREAD", label: "Non lues" }];

function groupLabel(iso) {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "Aujourd’hui";
  if (days === 1) return "Hier";
  if (days < 7) return "Cette semaine";
  return "Plus anciennes";
}

export default function CompanyNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("loading");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(() => {
    setState("loading");
    listCompanyNotifications({ limit: 100 }).then((result) => { setItems(result.items); setState("success"); }).catch(() => setState("error"));
  }, [refresh]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = "Notifications · PFE Connect"; }, []);
  const unread = items.filter((item) => !item.read).length;
  const visible = useMemo(() => items.filter((item) => (filter === "ALL" || !item.read) && item.title.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))), [items, filter, query]);
  const groups = useMemo(() => visible.reduce((result, item) => {
    const label = groupLabel(item.createdAt);
    (result[label] ??= []).push(item);
    return result;
  }, {}), [visible]);

  async function markAllRead() {
    setBusy(true); setNotice("");
    try {
      await markAllCompanyNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setNotice("Toutes les notifications sont marquées comme lues.");
    } catch { setNotice("Les notifications n’ont pas pu être mises à jour."); }
    finally { setBusy(false); }
  }

  async function openNotification(item) {
    if (!item.read) {
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, read: true } : row));
      try { await markCompanyNotificationRead(item.id); } catch { setItems((current) => current.map((row) => row.id === item.id ? { ...row, read: false } : row)); }
    }
    navigate(item.to ?? "/company");
  }

  return <div className="flex flex-col gap-8"><PageHeading title="Notifications" description="Retrouvez les actualités et les actions à suivre dans votre espace entreprise." action={unread > 0 && <button disabled={busy} onClick={markAllRead} className={`inline-flex items-center gap-2 rounded border border-line bg-surface px-4 py-3 text-sm font-semibold hover:bg-bg disabled:opacity-50 ${focusRing}`}><CheckCheck className="size-4"/>Tout marquer comme lu</button>}/>
    {state === "loading" ? <LoadingRows count={4}/> : state === "error" ? <LoadError onRetry={() => setRefresh((n) => n + 1)}/> : <><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Notifications" value={items.length}/><MetricCard label="Non lues" value={unread} note={unread ? "À consulter" : "Tout est à jour"}/><MetricCard label="Lues" value={items.length - unread}/></div>
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between"><div role="tablist" aria-label="Filtrer les notifications" className="flex gap-2">{filters.map((item) => <button key={item.id} role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`rounded px-4 py-2 text-sm font-medium ${focusRing} ${filter === item.id ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-soft hover:text-ink"}`}>{item.label}{item.id === "UNREAD" ? ` · ${unread}` : ` · ${items.length}`}</button>)}</div><label className="relative block w-full sm:max-w-xs"><span className="sr-only">Rechercher une notification</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher" className={`w-full rounded border border-line bg-surface py-2.5 pl-10 pr-3 text-sm placeholder:text-ink-soft ${focusRing}`}/></label></div>
      {visible.length === 0 ? <EmptyPanel title={filter === "UNREAD" ? "Aucune notification non lue" : "Aucune notification"} description={query ? "Essayez une autre recherche." : "Les nouvelles candidatures, conventions et validations apparaîtront ici."} icon={filter === "UNREAD" ? BellOff : Bell}/> : <div className="flex flex-col gap-8">{Object.entries(groups).map(([label, notifications]) => <section key={label} aria-labelledby={`group-${label}`}><h2 id={`group-${label}`} className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-ink-soft">{label}</h2><ul className="divide-y divide-line rounded border border-line bg-surface">{notifications.map((item) => { const itemCategory = category[item.type] ?? category.OFFER; const Icon = itemCategory.icon; return <li key={item.id}><button type="button" onClick={() => openNotification(item)} className={`group flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-bg sm:p-5 ${focusRing}`}><span className={`grid size-10 shrink-0 place-items-center rounded ${itemCategory.styles}`}><Icon className="size-4" aria-hidden="true"/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className={`text-xs font-semibold ${itemCategory.styles.split(" ").slice(-1)[0]}`}>{itemCategory.label}</span>{!item.read && <span className="size-2 rounded-full bg-accent" aria-label="Non lue"/>}</span><span className={`mt-1 block text-sm leading-6 ${item.read ? "text-ink-soft" : "font-semibold text-ink"}`}>{item.title}</span><time dateTime={item.createdAt} className="mt-1 block text-xs text-ink-soft">{formatDate(item.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></span><ChevronRight className="size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden="true"/></button></li>; })}</ul></section>)}</div>}
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    </>}
  </div>;
}
