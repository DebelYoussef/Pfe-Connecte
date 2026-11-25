import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Pencil, Plus } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import { invalidateReferenceData, default as useReferenceData } from "../../hooks/useReferenceData";
import {
  createInstitution,
  listDepartments,
  listInstitutions,
  listSpecialties,
  listUsers,
  PAGE_LIMIT,
  updateInstitution,
} from "../../services.admin";

async function allPages(fetchPage, filters = {}) {
  const items = [];
  let cursor;
  do {
    const page = await fetchPage({ ...filters, limit: PAGE_LIMIT, cursor });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

function InstitutionDialog({ institution, onClose, onSaved }) {
  const [name, setName] = useState(institution?.name || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (institution) {
        await updateInstitution(institution.id, { name: name.trim() });
      } else {
        await createInstitution({ name: name.trim() });
      }
      onSaved();
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = error?.status === 400 || error?.status === 409;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onSubmit={submit} role="dialog" aria-modal="true">
        <h3 className="mb-5 text-xl font-semibold">{institution ? "Renommer l’établissement" : "Ajouter un établissement"}</h3>
        {error && !fieldError && <ErrorBanner title="Impossible d’enregistrer l’établissement" message={error.message} />}
        <label className="block text-sm font-medium">
          Nom
          <input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800" autoFocus required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {fieldError && <p className="mt-1 text-sm text-red-600" role="alert">{error.message}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>Annuler</button>
          <button type="submit" className="hero-button" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminInstitutions() {
  const reference = useReferenceData();
  const [institutions, setInstitutions] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [statistics, setStatistics] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPage = useCallback(async ({ append = false, cursor } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const page = await listInstitutions({ limit: PAGE_LIMIT, cursor });
      setInstitutions((current) => append ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadPage());
  }, [loadPage, refreshKey]);

  useEffect(() => {
    let active = true;
    async function loadStatistics() {
      if (!institutions.length) return;
      try {
        const rows = await Promise.all(institutions.map(async (institution) => {
          const [departments, responsables] = await Promise.all([
            allPages(listDepartments, { etab: institution.id }),
            allPages(listUsers, { role: "RESP", etab: institution.id }),
          ]);
          const specialtyPages = await Promise.all(
            departments.map((department) =>
              allPages(listSpecialties, { department: department.id }),
            ),
          );
          return [institution.id, {
            departmentCount: departments.length,
            specialtyCount: specialtyPages.reduce((count, items) => count + items.length, 0),
            responsables,
          }];
        }));
        if (active) setStatistics((current) => ({ ...current, ...Object.fromEntries(rows) }));
      } catch (loadError) {
        if (active) setError(loadError);
      }
    }
    void loadStatistics();
    return () => { active = false; };
  }, [institutions]);

  const sortedInstitutions = useMemo(() => [...institutions].sort((a, b) => {
    const aHasResponsible = (statistics[a.id]?.responsables?.length || 0) > 0;
    const bHasResponsible = (statistics[b.id]?.responsables?.length || 0) > 0;
    return Number(bHasResponsible) - Number(aHasResponsible) || a.name.localeCompare(b.name, "fr");
  }), [institutions, statistics]);

  async function refreshAfterMutation() {
    invalidateReferenceData();
    reference.retry();
    setDialog(undefined);
    setStatistics({});
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Établissements"
        subtitle="Consultez les responsables, départements et spécialités."
        action={<button type="button" className="hero-button inline-flex items-center gap-2" onClick={() => setDialog(null)}><Plus size={17} />Ajouter</button>}
      />
      {error && <ErrorBanner title="Impossible de charger les établissements" message={error.message} onRetry={() => { void loadPage(); }} />}
      {reference.error && <ErrorBanner title="Référentiels indisponibles" message={reference.error.message} onRetry={reference.retry} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedInstitutions.map((institution) => {
          const stats = statistics[institution.id];
          const responsables = stats?.responsables || [];
          return (
            <article key={institution.id} className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-200"><Building2 size={20} /></span>
                  <div><h3 className="text-lg font-semibold">{institution.name}</h3></div>
                </div>
                <button type="button" className="rounded-lg border p-2" aria-label={`Renommer ${institution.name}`} onClick={() => setDialog(institution)}><Pencil size={15} /></button>
              </header>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><dt className="text-xs text-slate-500">Départements</dt><dd className="mt-1 font-semibold">{stats ? stats.departmentCount : "…"}</dd></div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><dt className="text-xs text-slate-500">Spécialités</dt><dd className="mt-1 font-semibold">{stats ? stats.specialtyCount : "…"}</dd></div>
              </dl>
              <div className="mt-4">
                <h4 className="text-sm font-semibold">Responsables</h4>
                {responsables.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {responsables.map((responsable) => <li key={responsable.userId}>{[responsable.firstName, responsable.lastName].filter(Boolean).join(" ") || responsable.email}</li>)}
                  </ul>
                ) : stats ? (
                  <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Aucun responsable</p>
                ) : <p className="mt-2 text-sm text-slate-500">Chargement…</p>}
              </div>
              {/* NEEDS BACKEND: teacher and student totals have no endpoint in the contract. */}
              <Link className="mt-5 inline-flex rounded-lg border px-3 py-2 text-sm font-medium" to={`/admin/etablissements/${encodeURIComponent(institution.id)}`}>Voir les détails</Link>
            </article>
          );
        })}
      </div>
      {!loading && institutions.length === 0 && !error && <p className="rounded-xl border bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">Aucun établissement.</p>}
      {loading && <p className="text-sm text-slate-500">Chargement…</p>}
      {nextCursor && <div className="text-center"><button type="button" className="rounded-lg border px-4 py-2" disabled={loading} onClick={() => { void loadPage({ append: true, cursor: nextCursor }); }}>Charger plus</button></div>}
      {dialog !== undefined && <InstitutionDialog institution={dialog} onClose={() => setDialog(undefined)} onSaved={() => { void refreshAfterMutation(); }} />}
    </div>
  );
}
