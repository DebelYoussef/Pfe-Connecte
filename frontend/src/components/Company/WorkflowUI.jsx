import { AlertTriangle, RotateCw } from "lucide-react";

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const REVIEW_STATUS = {
  TO_SIGN: { label: "À signer", className: "bg-accent-tint text-accent-ink" },
  IN_PROGRESS: { label: "En cours", className: "bg-primary-tint text-primary" },
  SIGNED: { label: "Signée", className: "bg-primary text-on-primary" },
  TO_REVIEW: { label: "À valider", className: "bg-accent-tint text-accent-ink" },
  APPROVED: { label: "Validé", className: "bg-primary text-on-primary" },
  REVISION: { label: "À corriger", className: "border border-line bg-bg text-ink-soft" },
};

export function StatusTag({ status }) {
  const item = REVIEW_STATUS[status] ?? { label: status, className: "bg-bg text-ink-soft" };
  return <span className={`inline-flex shrink-0 rounded px-2.5 py-1 text-xs font-semibold ${item.className}`}>{item.label}</span>;
}

export function PageHeading({ eyebrow = "Espace entreprise", title, description, action }) {
  return <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-accent-ink">{eyebrow}</p><h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-ink-soft">{description}</p>}</div>{action}</header>;
}

export function LoadError({ onRetry }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded border border-danger/30 bg-danger-tint p-5 text-sm"><span className="inline-flex items-center gap-2"><AlertTriangle className="size-4 text-danger"/>Impossible de charger ces informations.</span><button type="button" onClick={onRetry} className={`inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-2 font-medium ${focusRing}`}><RotateCw className="size-4"/>Réessayer</button></div>;
}

export function LoadingRows({ count = 3 }) {
  return <div aria-busy="true" className="space-y-3">{Array.from({ length: count }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded border border-line bg-skeleton"/>)}</div>;
}

export function EmptyPanel({ title, description, icon: Icon }) {
  return <div className="rounded border border-dashed border-line bg-surface px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded bg-primary-tint text-primary"><Icon className="size-5" aria-hidden="true"/></span><h2 className="mt-4 font-serif text-2xl font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">{description}</p></div>;
}

export function MetricCard({ label, value, note }) {
  return <div className="rounded border border-line bg-surface p-5"><p className="text-sm text-ink-soft">{label}</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{value}</p>{note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}</div>;
}

export function PersonAvatar({ name }) {
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded bg-primary-tint text-xs font-bold text-primary">{initials}</span>;
}

export function BackLink({ to, children }) {
  return <a href={to} className={`mb-7 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-primary ${focusRing}`}>{children}</a>;
}

export function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("fr-FR", options).format(new Date(value));
}
