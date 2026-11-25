import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, Search, UserRoundPen } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import useReferenceData from "../../hooks/useReferenceData";
import { useAdminOverview } from "../../context/AdminOverviewContext";
import {
  listUsers,
  PAGE_LIMIT,
  createUser,
  updateUser,
} from "../../services.admin";

const ROLES = [
  ["ALL", "Tous"],
  ["ETU", "Étudiants"],
  ["ENT", "Entreprises"],
  ["ENS", "Enseignants"],
  ["RESP", "Responsables"],
  ["ADM", "Administrateurs"],
];
const ROLE_LABELS = {
  ETU: "Étudiant",
  ENT: "Entreprise",
  ENS: "Enseignant",
  RESP: "Responsable",
  ADM: "Administrateur",
};

async function loadAllUsers(filters) {
  const items = [];
  let cursor;
  do {
    const page = await listUsers({ ...filters, limit: PAGE_LIMIT, cursor });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

function displayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function makePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const values = new Uint32Array(14);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function UserDialog({ user, institutions, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    email: user?.email || "",
    password: user ? "" : makePassword(),
    role: user?.role || "ETU",
    etab: user?.etab || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    department: user?.department || "",
    specialty: user?.specialty || "",
    companyName: user?.companyName || "",
    gouvernorat: user?.gouvernorat || "",
    confirmAdmin: false,
  }));
  const reference = useReferenceData({
    etab: values.etab,
    department: values.department,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [bannerError, setBannerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastResponsable, setLastResponsable] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const fieldLabel = "text-sm font-medium";
  const inputStyle = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white";

  const updateField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setBannerError(null);
    if (field === "etab") {
      setValues((current) => ({
        ...current,
        etab: value,
        department: "",
        specialty: "",
      }));
    }
    if (field === "department") {
      setValues((current) => ({ ...current, department: value, specialty: "" }));
    }
  };

  useEffect(() => {
    let active = true;
    async function checkResponsables() {
      if (!user || user.role !== "RESP" || (values.role === "RESP" && values.etab === user.etab)) {
        setLastResponsable(false);
        return;
      }
      try {
        const responsibles = await loadAllUsers({
          role: "RESP",
          etab: user.etab,
        });
        if (active) {
          setLastResponsable(responsibles.length <= 1);
        }
      } catch (error) {
        if (active) setBannerError(error);
      }
    }
    void checkResponsables();
    return () => {
      active = false;
    };
  }, [values.etab, values.role, user]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setBannerError(null);
    const payload = { role: values.role };
    if (!user) {
      payload.email = values.email.trim();
      payload.password = values.password;
    }
    if (["ETU", "ENS", "RESP"].includes(values.role)) {
      payload.etab = values.etab;
    }
    if (["ETU", "ENS", "RESP"].includes(values.role)) {
      payload.firstName = values.firstName.trim();
      payload.lastName = values.lastName.trim();
    }
    if (values.role === "ETU") {
      if (values.department) payload.department = values.department;
      if (values.specialty) payload.specialty = values.specialty;
    }
    if (values.role === "ENT") {
      payload.companyName = values.companyName.trim();
      if (values.gouvernorat) payload.gouvernorat = values.gouvernorat;
    }
    if (values.role === "ENS" && values.gouvernorat) {
      payload.gouvernorat = values.gouvernorat;
    }
    if (values.role === "ADM" && !values.confirmAdmin) {
      setFieldErrors({ confirmAdmin: "Confirmez la création du compte administrateur." });
      setSaving(false);
      return;
    }
    try {
      const saved = user
        ? await updateUser(user.userId, payload)
        : await createUser(payload);
      if (user) {
        onSaved(saved);
      } else {
        setCreatedCredentials({
          email: values.email.trim(),
          password: values.password,
        });
        onSaved(saved, true);
      }
    } catch (error) {
      if (error?.status === 409 && error?.code === "EMAIL_TAKEN") {
        setFieldErrors({ email: error.message || "Cette adresse e-mail est déjà utilisée." });
      } else if (error?.status === 400 && error?.code === "VALIDATION_ERROR") {
        const fields = error?.details?.fields;
        if (Array.isArray(fields) && fields.length) {
          const errors = {};
          fields.forEach((field) => {
            errors[field] = error.message || "Vérifiez ce champ.";
          });
          setFieldErrors(errors);
        } else {
          setBannerError(error);
        }
      } else if (error?.status === 403 && error?.code === "CANNOT_CHANGE_OWN_ROLE") {
        setFieldErrors({ role: error.message || "Vous ne pouvez pas modifier votre propre rôle." });
      } else {
        setBannerError(error);
      }
    } finally {
      setSaving(false);
    }
  }

  if (createdCredentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" role="dialog" aria-modal="true">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={20} />
            <h3 className="text-xl font-semibold">Compte créé</h3>
          </div>
          <p className="mb-4">Ces identifiants ne seront affichés qu’une seule fois. Transmettez le mot de passe à la personne concernée.</p>
          <dl className="space-y-2 rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
            <div><dt className="font-medium">Adresse e-mail</dt><dd>{createdCredentials.email}</dd></div>
            <div><dt className="font-medium">Mot de passe</dt><dd className="break-all font-mono">{createdCredentials.password}</dd></div>
          </dl>
          <button type="button" className="hero-button mt-5" onClick={onClose}>Fermer</button>
        </section>
      </div>
    );
  }

  function fieldError(field) {
    return fieldErrors[field] ? <p className="mt-1 text-sm text-red-600" role="alert">{fieldErrors[field]}</p> : null;
  }

  const userIsAdmin = values.role === "ADM";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <form className="my-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onSubmit={submit} role="dialog" aria-modal="true">
        <header className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold">{user ? "Modifier un compte" : "Créer un compte"}</h3>
          <button type="button" className="rounded px-2 py-1" onClick={onClose}>Fermer</button>
        </header>
        {bannerError && <ErrorBanner title="Impossible d’enregistrer le compte" message={bannerError.message} />}
        {reference.error && <ErrorBanner title="Référentiels indisponibles" message={reference.error.message} onRetry={reference.retry} />}
        {lastResponsable && <p className="mb-4 rounded-lg bg-amber-100 p-3 text-amber-900">Attention : cette modification laisserait l’établissement sans responsable.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {!user && (
            <label className={fieldLabel}>
              Adresse e-mail
              <input className={inputStyle} type="email" required value={values.email} onChange={(event) => updateField("email", event.target.value)} />
              {fieldError("email")}
            </label>
          )}
          {!user && (
            <label className={fieldLabel}>
              Mot de passe
              <div className="mt-1 flex gap-2">
                <input className={inputStyle} type="text" minLength={8} required value={values.password} onChange={(event) => updateField("password", event.target.value)} />
                <button type="button" className="rounded-lg border px-3" onClick={() => updateField("password", makePassword())}>Générer</button>
              </div>
              {fieldError("password")}
            </label>
          )}
          <label className={fieldLabel}>
            Rôle
            <select className={inputStyle} value={values.role} onChange={(event) => updateField("role", event.target.value)}>
              {ROLES.filter(([role]) => role !== "ALL").map(([role, label]) => <option key={role} value={role}>{label}</option>)}
            </select>
            {fieldError("role")}
          </label>
          {!userIsAdmin && values.role !== "ENT" && (
            <label className={fieldLabel}>
              Établissement
              <select className={inputStyle} required value={values.etab} onChange={(event) => updateField("etab", event.target.value)}>
                <option value="">Choisir un établissement</option>
                {institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {fieldError("etab")}
            </label>
          )}
          {!userIsAdmin && values.role !== "ENT" && (
            <>
              <label className={fieldLabel}>
                Prénom
                <input className={inputStyle} value={values.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
                {fieldError("firstName")}
              </label>
              <label className={fieldLabel}>
                Nom
                <input className={inputStyle} value={values.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
                {fieldError("lastName")}
              </label>
            </>
          )}
          {values.role === "ETU" && (
            <>
              <label className={fieldLabel}>
                Département
                <select className={inputStyle} value={values.department} onChange={(event) => updateField("department", event.target.value)} disabled={!values.etab || reference.loading}>
                  <option value="">Choisir un département</option>
                  {reference.departments.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
                </select>
                {fieldError("department")}
              </label>
              <label className={fieldLabel}>
                Spécialité
                <select className={inputStyle} value={values.specialty} onChange={(event) => updateField("specialty", event.target.value)} disabled={!values.department || reference.loading}>
                  <option value="">Choisir une spécialité</option>
                  {reference.specialties.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
                </select>
                {fieldError("specialty")}
              </label>
            </>
          )}
          {values.role === "ENT" && (
            <>
              <label className={fieldLabel}>
                Nom de l’entreprise
                <input className={inputStyle} required value={values.companyName} onChange={(event) => updateField("companyName", event.target.value)} />
                {fieldError("companyName")}
              </label>
              <label className={fieldLabel}>
                Gouvernorat
                <input className={inputStyle} value={values.gouvernorat} onChange={(event) => updateField("gouvernorat", event.target.value)} />
                {fieldError("gouvernorat")}
              </label>
            </>
          )}
          {values.role === "ADM" && (
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={values.confirmAdmin} onChange={(event) => updateField("confirmAdmin", event.target.checked)} />
              <span>Je confirme la création d’un compte administrateur.</span>
            </label>
          )}
          {fieldError("confirmAdmin")}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>Annuler</button>
          <button type="submit" className="hero-button" disabled={saving || Boolean(reference.error)}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminUsers() {
  const {
    institutions: referenceInstitutions,
    error: referenceError,
    retry: retryReference,
    getDepartments,
    getSpecialties,
  } = useReferenceData();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRole = searchParams.get("role");
  const role = ROLES.some(([key]) => key === requestedRole) ? requestedRole : "ALL";
  const {
    overview,
    error: overviewError,
    refresh: refreshOverview,
  } = useAdminOverview();
  const [etab, setEtab] = useState("");
  const [users, setUsers] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogUser, setDialogUser] = useState(undefined);
  const [exactEmail, setExactEmail] = useState("");
  const [metadata, setMetadata] = useState({});
  const [metadataError, setMetadataError] = useState(null);
  const [metadataRetry, setMetadataRetry] = useState(0);

  const filters = useMemo(
    () => ({ ...(role !== "ALL" ? { role } : {}), ...(etab ? { etab } : {}) }),
    [role, etab],
  );

  const refreshList = useCallback(async ({ append = false, cursor } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers({ ...filters, limit: PAGE_LIMIT, cursor });
      setUsers((current) => append ? [...current, ...result.items] : result.items);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(() => refreshList());
  }, [refreshList]);

  useEffect(() => {
    let active = true;
    async function loadMetadata() {
      if (!users.length || !referenceInstitutions.length) {
        setMetadata({});
        return;
      }
      setMetadataError(null);
      try {
        const departmentsByInstitution = new Map(
          await Promise.all(referenceInstitutions.map(async (institution) => [
            institution.id,
            await getDepartments(institution.id),
          ])),
        );
        const entries = [];
        for (const user of users) {
          const department = (departmentsByInstitution.get(user.etab) || []).find(
            (item) => item.code === user.department,
          );
          if (!department) continue;
          const specialties = user.specialty
            ? await getSpecialties(department.id)
            : [];
          const specialty = specialties.find((item) => item.code === user.specialty);
          entries.push([`${user.etab}:${user.department}`, {
            departmentName: department.name,
            specialtyName: specialty?.name || "",
          }]);
        }
        if (active) setMetadata(Object.fromEntries(entries));
      } catch (loadError) {
        if (active) setMetadataError(loadError);
      }
    }
    void loadMetadata();
    return () => { active = false; };
  }, [users, referenceInstitutions, getDepartments, getSpecialties, metadataRetry]);

  const shownUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("fr");
    if (!term) return users;
    return users.filter((user) =>
      [user.email, user.firstName, user.lastName, user.companyName]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("fr").includes(term)),
    );
  }, [users, search]);

  async function exactEmailSearch(event) {
    event.preventDefault();
    if (!exactEmail.trim()) return;
    setLoading(true);
    setError(null);
    setSearch("");
    try {
      const result = await listUsers({
        ...filters,
        email: exactEmail.trim(),
        limit: PAGE_LIMIT,
      });
      setUsers(result.items);
      setNextCursor(null);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  async function onSaved(_saved, isCreated = false) {
    await refreshList();
    if (!isCreated) setDialogUser(undefined);
  }

  const institutionNames = new Map(referenceInstitutions.map((item) => [item.id, item.name]));
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Comptes"
        subtitle="Gérez les comptes et leurs rôles."
        action={<button type="button" className="hero-button inline-flex items-center gap-2" onClick={() => setDialogUser(null)}><Plus size={17} />Créer un compte</button>}
      />
      {error && <ErrorBanner title="Impossible de charger les comptes" message={error.message} onRetry={() => { void refreshList(); }} />}
      {overviewError && <ErrorBanner title="Impossible de charger les compteurs" message={overviewError.message} onRetry={() => { void refreshOverview(); }} />}
      {referenceError && <ErrorBanner title="Référentiels indisponibles" message={referenceError.message} onRetry={retryReference} />}
      {metadataError && <ErrorBanner title="Noms de départements indisponibles" message={metadataError.message} onRetry={() => setMetadataRetry((value) => value + 1)} />}
      <section className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Comptes par rôle">
        {ROLES.map(([roleKey, label]) => {
          const count = roleKey === "ALL"
            ? Object.values(overview?.usersByRole || {}).reduce((sum, value) => sum + value, 0)
            : overview?.usersByRole?.[roleKey];
          return (
            <button key={roleKey} type="button" onClick={() => { setSearchParams(roleKey === "ALL" ? {} : { role: roleKey }); setSearch(""); }}
              className={`rounded-xl border p-3 text-left ${role === roleKey ? "border-blue-600 bg-blue-50 dark:bg-blue-950" : "bg-white dark:bg-slate-900"}`}>
              <span className="block text-sm">{label}</span>
              <strong className="mt-1 block text-xl">{count ?? "—"}</strong>
            </button>
          );
        })}
      </section>
      <section className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Établissement
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800" value={etab} onChange={(event) => { setEtab(event.target.value); setSearch(""); }}>
              <option value="">Tous les établissements</option>
              {referenceInstitutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">
            Rechercher parmi les comptes chargés
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 px-3 dark:border-slate-600">
              <Search size={16} />
              <input className="w-full border-0 bg-transparent py-2 outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, entreprise ou e-mail" />
            </div>
            <span className="mt-1 block text-xs text-slate-500">La recherche porte sur les comptes chargés</span>
          </label>
        </div>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={exactEmailSearch}>
          <input className="min-w-52 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800" type="email" value={exactEmail} onChange={(event) => setExactEmail(event.target.value)} placeholder="adresse@exemple.fr" aria-label="Adresse e-mail exacte" />
          <button type="submit" className="rounded-lg border px-4 py-2" disabled={loading}><Search size={15} className="mr-1 inline" />Rechercher par e-mail exact</button>
        </form>
      </section>
      <section className="overflow-x-auto rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>{["Compte", "Rôle", "Établissement", "Département", "Spécialité", ""].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {shownUsers.map((user) => {
              const institutionName = institutionNames.get(user.etab);
              const label = user.role === "ENT"
                ? user.companyName || "—"
                : user.role === "RESP"
                  ? `Responsable de ${institutionName || "—"}`
                  : displayName(user);
              const detail = metadata[`${user.etab}:${user.department}`];
              return (
                <tr key={user.userId} className="border-b last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3"><strong className="block">{label}</strong><span className="text-slate-500">{user.email}</span></td>
                  <td className="px-4 py-3">{ROLE_LABELS[user.role] || user.role}</td>
                  <td className="px-4 py-3">{institutionName || "—"}</td>
                  <td className={`px-4 py-3 ${user.department && !detail?.departmentName ? "text-slate-500" : ""}`}>{user.role === "ETU" ? detail?.departmentName || user.department || "—" : "—"}</td>
                  <td className={`px-4 py-3 ${user.specialty && !detail?.specialtyName ? "text-slate-500" : ""}`}>{user.role === "ETU" ? detail?.specialtyName || user.specialty || "—" : "—"}</td>
                  <td className="px-4 py-3 text-right"><button type="button" className="rounded-lg border px-3 py-2" onClick={() => setDialogUser(user)} aria-label={`Modifier ${user.email}`}><UserRoundPen size={16} /></button></td>
                </tr>
              );
            })}
            {!loading && shownUsers.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="6">Aucun compte correspondant.</td></tr>}
          </tbody>
        </table>
        {loading && <p className="p-4 text-sm text-slate-500">Chargement…</p>}
        {nextCursor && <div className="border-t p-4 text-center dark:border-slate-700"><button type="button" className="rounded-lg border px-4 py-2" disabled={loading} onClick={() => { void refreshList({ append: true, cursor: nextCursor }); }}>Charger plus</button></div>}
      </section>
      {dialogUser !== undefined && (
        <UserDialog
          user={dialogUser}
          institutions={referenceInstitutions}
          onClose={() => setDialogUser(undefined)}
          onSaved={(saved, created) => { void onSaved(saved, created); }}
        />
      )}
    </div>
  );
}
