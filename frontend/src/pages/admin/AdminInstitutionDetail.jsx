import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import useReferenceData, { invalidateReferenceData } from "../../hooks/useReferenceData";
import {
  createDepartment,
  createSpecialty,
  listDepartments,
  listSpecialties,
  listUsers,
  PAGE_LIMIT,
  updateDepartment,
  updateInstitution,
  updateSpecialty,
} from "../../services.admin";

function EditNameDialog({ title, initialName, onClose, onSave }) {
  const [name, setName] = useState(initialName || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim());
      onClose();
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
        <h3 className="mb-5 text-xl font-semibold">{title}</h3>
        {error && !fieldError && <ErrorBanner title="Impossible d’enregistrer" message={error.message} />}
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

async function loadDepartments(etab, cursor) {
  return listDepartments({ etab, limit: PAGE_LIMIT, cursor });
}

export default function AdminInstitutionDetail() {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const reference = useReferenceData();
  const institution = useMemo(
    () => reference.institutions.find((item) => item.id === institutionId),
    [reference.institutions, institutionId],
  );
  const [departments, setDepartments] = useState([]);
  const [departmentCursor, setDepartmentCursor] = useState(null);
  const [responsables, setResponsables] = useState([]);
  const [responsableCursor, setResponsableCursor] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async ({ appendDepartments = false, deptCursor, appendResponsables = false, respCursor } = {}) => {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    try {
      const loadBoth = !appendDepartments && !appendResponsables;
      const [departmentPage, responsablePage] = await Promise.all([
        loadBoth || appendDepartments ? loadDepartments(institutionId, deptCursor) : Promise.resolve(null),
        loadBoth || appendResponsables ? listUsers({
          role: "RESP",
          etab: institutionId,
          limit: PAGE_LIMIT,
          cursor: respCursor,
        }) : Promise.resolve(null),
      ]);
      if (departmentPage) {
        const enriched = await Promise.all(departmentPage.items.map(async (department) => {
          const page = await listSpecialties({
            department: department.id,
            limit: PAGE_LIMIT,
          });
          return { ...department, specialties: page.items, specialtiesCursor: page.nextCursor };
        }));
        setDepartments((current) => appendDepartments ? [...current, ...enriched] : enriched);
        setDepartmentCursor(departmentPage.nextCursor);
      }
      if (responsablePage) {
        setResponsables((current) => appendResponsables ? [...current, ...responsablePage.items] : responsablePage.items);
        setResponsableCursor(responsablePage.nextCursor);
      }
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh, reloadKey]);

  async function afterMutation() {
    invalidateReferenceData();
    reference.retry();
    setDepartments([]);
    setResponsables([]);
    setDialog(null);
    setReloadKey((value) => value + 1);
  }

  async function loadMoreSpecialties(department) {
    try {
      const page = await listSpecialties({
        department: department.id,
        limit: PAGE_LIMIT,
        cursor: department.specialtiesCursor,
      });
      setDepartments((current) => current.map((item) =>
        item.id === department.id
          ? {
            ...item,
            specialties: [...item.specialties, ...page.items],
            specialtiesCursor: page.nextCursor,
          }
          : item,
      ));
    } catch (loadError) {
      setError(loadError);
    }
  }

  const headerAction = (
    <button type="button" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2" onClick={() => navigate("/admin/etablissements")}>
      <ArrowLeft size={16} />Retour
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Établissements"
        title={institution?.name || "Détail de l’établissement"}
        subtitle="Gérez les responsables, départements et spécialités."
        action={headerAction}
      />
      {error && <ErrorBanner title="Impossible de charger les données" message={error.message} onRetry={() => { void refresh(); }} />}
      {reference.error && <ErrorBanner title="Référentiels indisponibles" message={reference.error.message} onRetry={reference.retry} />}
      {!institution && !reference.loading && !reference.error && <p className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">Établissement introuvable.</p>}

      {institution && (
        <>
          <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-center justify-between gap-4">
              <div><h3 className="text-lg font-semibold">Responsables</h3><p className="text-sm text-slate-500">Personnes responsables de cet établissement</p></div>
              <button type="button" className="rounded-lg border p-2" onClick={() => setDialog({ kind: "institution", institution })} aria-label="Renommer l’établissement"><Pencil size={16} /></button>
            </header>
            {responsables.length ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {responsables.map((item) => <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800" key={item.userId}><strong>{[item.firstName, item.lastName].filter(Boolean).join(" ") || item.email}</strong><span className="block text-sm text-slate-500">{item.email}</span></li>)}
              </ul>
            ) : <p className="mt-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">Aucun responsable</p>}
            {responsableCursor && <button type="button" className="mt-3 rounded-lg border px-3 py-2" disabled={loading} onClick={() => { void refresh({ appendResponsables: true, respCursor: responsableCursor }); }}>Charger plus de responsables</button>}
          </section>

          <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <header className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">Départements</h3>
              <button type="button" className="hero-button inline-flex items-center gap-2" onClick={() => setDialog({ kind: "department" })}><Plus size={16} />Ajouter un département</button>
            </header>
            <div className="space-y-4">
              {departments.map((department) => (
                <article className="rounded-xl border p-4 dark:border-slate-700" key={department.id}>
                  <header className="flex items-center justify-between gap-3">
                    <div><h4 className="font-semibold">{department.name}</h4></div>
                    <div className="flex gap-2">
                      <button type="button" className="rounded-lg border p-2" aria-label={`Modifier ${department.name}`} onClick={() => setDialog({ kind: "department", department })}><Pencil size={15} /></button>
                      <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm" onClick={() => setDialog({ kind: "specialty", department })}><Plus size={14} />Spécialité</button>
                    </div>
                  </header>
                  <h5 className="mt-4 text-sm font-medium">Spécialités</h5>
                  {department.specialties.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {department.specialties.map((specialty) => (
                        <li key={specialty.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                          {specialty.name}
                          <button type="button" aria-label={`Modifier ${specialty.name}`} className="rounded p-1" onClick={() => setDialog({ kind: "specialty", department, specialty })}><Pencil size={13} /></button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-sm text-slate-500">Aucune spécialité.</p>}
                  {department.specialtiesCursor && <button type="button" className="mt-3 rounded-lg border px-3 py-2 text-sm" onClick={() => { void loadMoreSpecialties(department); }}>Charger plus de spécialités</button>}
                </article>
              ))}
              {!departments.length && !loading && <p className="text-sm text-slate-500">Aucun département.</p>}
              {departmentCursor && <button type="button" className="rounded-lg border px-3 py-2" disabled={loading} onClick={() => { void refresh({ appendDepartments: true, deptCursor: departmentCursor }); }}>Charger plus de départements</button>}
            </div>
          </section>
        </>
      )}
      {loading && <p className="text-sm text-slate-500">Chargement…</p>}
      {dialog?.kind === "institution" && (
        <EditNameDialog
          title="Renommer l’établissement"
          initialName={dialog.institution.name}
          onClose={() => setDialog(null)}
          onSave={async (name) => {
            await updateInstitution(dialog.institution.id, { name });
            await afterMutation();
          }}
        />
      )}
      {dialog?.kind === "department" && (
        <EditNameDialog
          title={dialog.department ? "Renommer le département" : "Ajouter un département"}
          initialName={dialog.department?.name}
          onClose={() => setDialog(null)}
          onSave={async (name) => {
            if (dialog.department) {
              await updateDepartment(dialog.department.id, { name });
            } else {
              await createDepartment({ etab: institutionId, name });
            }
            await afterMutation();
          }}
        />
      )}
      {dialog?.kind === "specialty" && (
        <EditNameDialog
          title={dialog.specialty ? "Renommer la spécialité" : `Ajouter une spécialité à ${dialog.department.name}`}
          initialName={dialog.specialty?.name}
          onClose={() => setDialog(null)}
          onSave={async (name) => {
            if (dialog.specialty) {
              await updateSpecialty(dialog.specialty.id, { name });
            } else {
              await createSpecialty({ department: dialog.department.id, name });
            }
            await afterMutation();
          }}
        />
      )}
    </div>
  );
}
