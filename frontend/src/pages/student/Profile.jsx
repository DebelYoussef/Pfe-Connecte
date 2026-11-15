import {
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronDown,
  Download,
  FileText,
  GitBranch,
  Globe,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import ErrorBanner, { getErrorBanner } from "../../components/ErrorBanner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import {
  createAvatarUploadUrl,
  createCvUploadUrl,
  deleteMyCv,
  getCvDownloadUrl,
  getMe,
  updateMe,
  uploadToPresignedPost,
} from "../../services";
import ActionButton from "./parts/ActionButton";
import FileDropzone from "./parts/FileDropzone";
import RetryBanner from "./parts/RetryBanner";
import SkillTagEditor, { normalizeSkill } from "./parts/SkillTagEditor";
import useUnsavedWarning from "./parts/useUnsavedWarning";
import {
  card,
  fieldError,
  fieldHint,
  fieldLabel,
  focusRing,
  formatBytes,
  formatDate,
  input,
  inputReadOnly,
  linkButton,
  sectionTitle,
} from "./parts/ui";

const DEPARTMENTS = [
  { value: "INFO", label: "Informatique" },
  { value: "TELECOM", label: "Télécommunications" },
];
// Same values the sign-up form sends.
const SPECIALTIES = ["Génie logiciel", "Réseaux", "Data science", "Systèmes embarqués"];
const GOUVERNORATS = ["Tunis", "Sousse", "Sfax", "Monastir", "Nabeul", "Gabès", "Gafsa", "Bizerte"];
const SKILL_SUGGESTIONS = ["python", "java", "aws", "docker", "react", "sql", "spring", "linux", "kubernetes", "django", "typescript", "git", "mongodb", "node", "angular"];
const LINKS = [
  { key: "linkedin", label: "LinkedIn", icon: BriefcaseBusiness, placeholder: "https://www.linkedin.com/in/votre-profil", host: "linkedin.com" },
  { key: "github", label: "GitHub", icon: GitBranch, placeholder: "https://github.com/votre-pseudo", host: "github.com" },
  { key: "portfolio", label: "Portfolio", icon: Globe, placeholder: "https://votre-site.tn" },
];
const AVATAR_MAX = 2 * 1024 * 1024;
const CV_MAX = 5 * 1024 * 1024;
const BIO_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeDepartment = (value) =>
  DEPARTMENTS.find((item) => item.value === value || item.label === value)?.value || "";
const departmentLabel = (value) => DEPARTMENTS.find((item) => item.value === value)?.label || value || "";

function linkError(link, value) {
  if (!value.trim()) return "";
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return "Saisissez une adresse complète commençant par https://";
  }
  if (!["http:", "https:"].includes(url.protocol)) return "L’adresse doit commencer par https://";
  if (link.host && !url.hostname.replace(/^www\./, "").endsWith(link.host))
    return `L’adresse doit pointer vers ${link.host}`;
  return "";
}

const formsFrom = (me) => ({
  identity: {
    firstName: me.firstName || "",
    lastName: me.lastName || "",
    contactEmail: me.contactEmail || me.email || "",
  },
  path: {
    department: normalizeDepartment(me.department),
    specialty: me.specialty || "",
    gouvernorat: me.gouvernorat || "",
  },
  bio: { bio: me.bio || "" },
  skills: { skills: (me.skills || []).map(normalizeSkill) },
  links: { linkedin: me.links?.linkedin || "", github: me.links?.github || "", portfolio: me.links?.portfolio || "" },
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Section({ id, title, description, dirty, saving, error, onDismissError, onSave, invalidReason, children }) {
  return (
    <section id={id} className={`${card} scroll-mt-24 p-6`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={sectionTitle}>
        {title}
      </h2>
      {description && <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">{description}</p>}
      {error && (
        <div className="mt-4">
          <ErrorBanner title={error.title} message={error.message} onClose={onDismissError} />
        </div>
      )}
      <div className="mt-5 flex flex-col gap-4">{children}</div>
      {onSave && (
        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <ActionButton
            loading={saving}
            disabledReason={!dirty ? "Aucune modification à enregistrer" : invalidReason}
            onClick={onSave}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </ActionButton>
        </div>
      )}
    </section>
  );
}

function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={fieldLabel}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className={fieldError}>
          {error}
        </p>
      ) : (
        hint && <p className={fieldHint}>{hint}</p>
      )}
    </div>
  );
}

function SelectField({ id, label, value, onChange, placeholder, options }) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${input} appearance-none pr-10 cursor-pointer`}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
      </div>
    </Field>
  );
}

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [base, setBase] = useState(null);
  const [forms, setForms] = useState(null);
  const [saving, setSaving] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const closeToast = useCallback(() => setToast(""), []);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [cvProgress, setCvProgress] = useState(null);
  const [cvReplacing, setCvReplacing] = useState(false);
  const [confirmCvDelete, setConfirmCvDelete] = useState(false);
  const avatarInputId = useId();
  const avatarButtonRef = useRef(null);

  const load = useCallback(() => {
    setLoadError(null);
    return getMe()
      .then((data) => {
        setMe(data);
        const next = formsFrom(data);
        setBase(next);
        setForms(next);
      })
      .catch(setLoadError);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = forms && base ? Object.fromEntries(Object.keys(forms).map((key) => [key, !same(forms[key], base[key])])) : {};
  const anyDirty = Object.values(dirty).some(Boolean) || Boolean(cvFile);
  useUnsavedWarning(anyDirty);

  const setField = (section, key, value) =>
    setForms((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));

  async function saveSection(section, payload) {
    setSaving((value) => ({ ...value, [section]: true }));
    setErrors((value) => ({ ...value, [section]: null }));
    try {
      const updated = await updateMe(payload);
      setMe(updated);
      const fresh = formsFrom(updated);
      setBase((value) => ({ ...value, [section]: fresh[section] }));
      setForms((value) => ({ ...value, [section]: fresh[section] }));
      setToast("Profil mis à jour");
    } catch (error) {
      setErrors((value) => ({ ...value, [section]: getErrorBanner(error) }));
    } finally {
      setSaving((value) => ({ ...value, [section]: false }));
    }
  }

  async function changeAvatar(file) {
    if (!file) return;
    setAvatarError("");
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setAvatarError("Seules les images JPG ou PNG sont acceptées.");
      return;
    }
    if (file.size > AVATAR_MAX) {
      setAvatarError("Image trop volumineuse (2 Mo maximum).");
      return;
    }
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarBusy(true);
    try {
      const presigned = await createAvatarUploadUrl();
      await uploadToPresignedPost(presigned, file);
      setMe(await getMe());
      setToast("Photo mise à jour");
    } catch (error) {
      setAvatarPreview(null);
      setAvatarError(error?.message || "La photo n’a pas pu être envoyée.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      setMe(await updateMe({ avatarUrl: null }));
      setAvatarPreview(null);
      setToast("Photo supprimée");
    } catch (error) {
      setAvatarError(error?.message || "La photo n’a pas pu être supprimée.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function uploadCv() {
    if (!cvFile) return;
    setSaving((value) => ({ ...value, cv: true }));
    setErrors((value) => ({ ...value, cv: null }));
    try {
      setCvProgress(0);
      const presigned = await createCvUploadUrl();
      await uploadToPresignedPost(presigned, cvFile, setCvProgress);
      setMe(await getMe());
      setCvFile(null);
      setCvReplacing(false);
      setToast("Profil mis à jour");
    } catch (error) {
      setErrors((value) => ({ ...value, cv: getErrorBanner(error) }));
    } finally {
      setCvProgress(null);
      setSaving((value) => ({ ...value, cv: false }));
    }
  }

  async function downloadCv() {
    try {
      const { url } = await getCvDownloadUrl();
      if (url.startsWith("#")) setToast("Téléchargement simulé : aucun fichier de démonstration.");
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrors((value) => ({ ...value, cv: getErrorBanner(error) }));
    }
  }

  async function removeCv() {
    setConfirmCvDelete(false);
    setSaving((value) => ({ ...value, cv: true }));
    try {
      setMe(await deleteMyCv());
      setToast("CV supprimé");
    } catch (error) {
      setErrors((value) => ({ ...value, cv: getErrorBanner(error) }));
    } finally {
      setSaving((value) => ({ ...value, cv: false }));
    }
  }

  function goTo(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.querySelector("input:not([readonly]), select, textarea, button")?.focus({ preventScroll: true });
  }

  if (loadError && !me)
    return (
      <section className="student-page">
        <PageHeader eyebrow="Mon compte" title="Mon profil" subtitle="Gérez les informations de votre espace étudiant." />
        <RetryBanner
          title="Le profil n’a pas pu être chargé"
          message={loadError.message}
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            load().finally(() => setRetrying(false));
          }}
        />
      </section>
    );

  if (!me || !forms)
    return (
      <section className="student-page" aria-busy="true">
        <PageHeader eyebrow="Mon compte" title="Mon profil" subtitle="Gérez les informations de votre espace étudiant." />
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton />
          <div>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        </div>
      </section>
    );

  const fullName = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;
  const initials =
    [me.firstName, me.lastName]
      .filter(Boolean)
      .map((value) => value[0])
      .join("")
      .toUpperCase() || (me.email || "?")[0].toUpperCase();
  const avatar = avatarPreview || me.avatarUrl;
  const subtitle = ["Étudiant", me.specialty, me.etab].filter(Boolean).join(" · ");

  const checklist = [
    { done: Boolean(me.avatarUrl), label: "Ajouter une photo", target: "profil-identite" },
    { done: Boolean(me.bio?.trim()), label: "Rédiger une présentation", target: "profil-presentation" },
    { done: (me.skills || []).length > 0, label: "Ajouter des compétences", target: "profil-competences" },
    { done: Boolean(me.cvFileName), label: "Déposer votre CV", target: "profil-cv" },
    { done: LINKS.some((link) => me.links?.[link.key]), label: "Ajouter un lien", target: "profil-liens" },
    { done: Boolean(me.gouvernorat), label: "Indiquer votre gouvernorat", target: "profil-parcours" },
    { done: Boolean(normalizeDepartment(me.department)), label: "Choisir votre département", target: "profil-parcours" },
    { done: Boolean(me.specialty), label: "Choisir votre spécialité", target: "profil-parcours" },
  ];
  const completion = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
  const missing = checklist.filter((item) => !item.done);

  const { identity, path, bio, skills, links } = forms;
  const firstNameError = !identity.firstName.trim() ? "Le prénom est obligatoire." : "";
  const lastNameError = !identity.lastName.trim() ? "Le nom est obligatoire." : "";
  const contactError = identity.contactEmail && !EMAIL_RE.test(identity.contactEmail) ? "Saisissez une adresse e-mail valide." : "";
  const linkErrors = Object.fromEntries(LINKS.map((link) => [link.key, linkError(link, links[link.key])]));
  const showCvDropzone = !me.cvFileName || cvReplacing;

  return (
    <section className="student-page">
      <PageHeader eyebrow="Mon compte" title="Mon profil" subtitle="Gérez les informations de votre espace étudiant." />

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside id="profil-identite" className={`${card} flex flex-col items-center p-6 text-center lg:sticky lg:top-[100px]`}>
          <div className="relative h-[120px] w-[120px] overflow-hidden rounded-[4px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]">
            {avatar ? (
              <img src={avatar} alt={`Photo de ${fullName}`} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center font-['Source_Serif_4',Georgia,serif] text-[38px] font-semibold text-[var(--primary)]">
                {initials}
              </span>
            )}
            {avatarBusy && (
              <span className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] text-[12px] font-semibold text-[var(--primary)]">
                Envoi…
              </span>
            )}
          </div>
          <input
            id={avatarInputId}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              changeAvatar(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              ref={avatarButtonRef}
              type="button"
              className={linkButton}
              disabled={avatarBusy}
              onClick={() => document.getElementById(avatarInputId)?.click()}
            >
              <Camera size={13} aria-hidden="true" />
              Changer la photo
            </button>
            {avatar && (
              <button type="button" className={`${linkButton} text-[var(--danger)]!`} disabled={avatarBusy} onClick={removeAvatar}>
                Supprimer
              </button>
            )}
          </div>
          <p className="m-0 mt-1 text-[11px] text-[var(--muted)]">JPG ou PNG, 2 Mo maximum</p>
          {avatarError && (
            <p role="alert" className={fieldError}>
              {avatarError}
            </p>
          )}

          <h2 className={`${sectionTitle} mt-5`}>{fullName}</h2>
          <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">{subtitle}</p>
          <p className="m-0 mt-1 break-all text-[12px] text-[var(--text)]">{me.email}</p>

          <div className="mt-6 w-full border-t border-[var(--border)] pt-5 text-left">
            <div className="flex items-baseline justify-between">
              <strong className="text-[13px] text-[var(--text)]">Profil complété</strong>
              <strong className="font-['Source_Serif_4',Georgia,serif] text-[20px] text-[var(--primary)]">{completion} %</strong>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-[var(--border)]"
              role="progressbar"
              aria-label="Profil complété"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <span className="block h-full bg-[var(--primary)] transition-[width] duration-300" style={{ width: `${completion}%` }} />
            </div>
            {missing.length > 0 ? (
              <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                {missing.map((item) => (
                  <li key={item.label}>
                    <button type="button" className={linkButton} onClick={() => goTo(item.target)}>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-3 flex items-center gap-1.5 text-[12px] text-[var(--success,#2e7d5b)]">
                <Check size={14} aria-hidden="true" /> Votre profil est complet.
              </p>
            )}
            <p className="m-0 mt-4 text-[11px] text-[var(--muted)]">Votre profil alimente vos recommandations d’offres.</p>
          </div>
        </aside>

        <div className="flex flex-col gap-5">
          <Section
            id="profil-infos"
            title="Informations personnelles"
            dirty={dirty.identity}
            saving={saving.identity}
            error={errors.identity}
            onDismissError={() => setErrors((value) => ({ ...value, identity: null }))}
            invalidReason={firstNameError || lastNameError || contactError || undefined}
            onSave={() =>
              saveSection("identity", {
                firstName: identity.firstName.trim(),
                lastName: identity.lastName.trim(),
                contactEmail: identity.contactEmail.trim() === me.email ? "" : identity.contactEmail.trim(),
              })
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="profile-first-name" error={dirty.identity ? firstNameError : ""}>
                <input
                  id="profile-first-name"
                  className={input}
                  value={identity.firstName}
                  autoComplete="given-name"
                  aria-invalid={dirty.identity && firstNameError ? "true" : undefined}
                  onChange={(event) => setField("identity", "firstName", event.target.value)}
                />
              </Field>
              <Field label="Nom" htmlFor="profile-last-name" error={dirty.identity ? lastNameError : ""}>
                <input
                  id="profile-last-name"
                  className={input}
                  value={identity.lastName}
                  autoComplete="family-name"
                  aria-invalid={dirty.identity && lastNameError ? "true" : undefined}
                  onChange={(event) => setField("identity", "lastName", event.target.value)}
                />
              </Field>
            </div>
            <Field label="E-mail de connexion" htmlFor="profile-login-email" hint="Utilisé pour vous connecter, non modifiable.">
              <div className="relative">
                <input id="profile-login-email" className={`${input} ${inputReadOnly} pr-10`} value={me.email || ""} readOnly />
                <Lock size={15} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              </div>
            </Field>
            <Field label="E-mail de contact (facultatif)" htmlFor="profile-contact-email" error={contactError}>
              <input
                id="profile-contact-email"
                type="email"
                className={input}
                value={identity.contactEmail}
                autoComplete="email"
                aria-invalid={contactError ? "true" : undefined}
                onChange={(event) => setField("identity", "contactEmail", event.target.value)}
              />
              {identity.contactEmail !== me.email && (
                <button type="button" className={`${linkButton} mt-2`} onClick={() => setField("identity", "contactEmail", me.email || "")}>
                  Utiliser l’e-mail de connexion
                </button>
              )}
            </Field>
            <Field label="Établissement" htmlFor="profile-etab" hint="Contactez votre responsable pour le modifier.">
              <div className="relative">
                <input id="profile-etab" className={`${input} ${inputReadOnly} pr-10`} value={me.etab || ""} readOnly />
                <Lock size={15} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              </div>
            </Field>
          </Section>

          <Section
            id="profil-parcours"
            title="Parcours"
            description="Ces informations servent à vous recommander des offres."
            dirty={dirty.path}
            saving={saving.path}
            error={errors.path}
            onDismissError={() => setErrors((value) => ({ ...value, path: null }))}
            onSave={() => saveSection("path", path)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="profile-department"
                label="Département"
                placeholder="Choisir un département"
                value={path.department}
                onChange={(value) => setField("path", "department", value)}
                options={DEPARTMENTS}
              />
              <SelectField
                id="profile-specialty"
                label="Spécialité"
                placeholder="Choisir une spécialité"
                value={path.specialty}
                onChange={(value) => setField("path", "specialty", value)}
                options={[...new Set([...SPECIALTIES, ...(path.specialty ? [path.specialty] : [])])].map((value) => ({ value, label: value }))}
              />
            </div>
            <SelectField
              id="profile-gouvernorat"
              label="Gouvernorat"
              placeholder="Choisir un gouvernorat"
              value={path.gouvernorat}
              onChange={(value) => setField("path", "gouvernorat", value)}
              options={[...new Set([...GOUVERNORATS, ...(path.gouvernorat ? [path.gouvernorat] : [])])].map((value) => ({ value, label: value }))}
            />
            {path.department && (
              <p className="m-0 text-[12px] text-[var(--muted)]">
                {departmentLabel(path.department)} · {path.specialty || "spécialité à choisir"}
              </p>
            )}
          </Section>

          <Section
            id="profil-presentation"
            title="Présentation"
            description="Quelques lignes pour les entreprises qui consultent votre candidature."
            dirty={dirty.bio}
            saving={saving.bio}
            error={errors.bio}
            onDismissError={() => setErrors((value) => ({ ...value, bio: null }))}
            onSave={() => saveSection("bio", { bio: bio.bio.trim() })}
          >
            <div>
              <label htmlFor="profile-bio" className="sr-only">
                Présentation
              </label>
              <textarea
                id="profile-bio"
                value={bio.bio}
                maxLength={BIO_MAX}
                onChange={(event) => setField("bio", "bio", event.target.value)}
                placeholder="Ex. Étudiant en génie logiciel, passionné par le développement web et l’accessibilité."
                className={`block min-h-[130px] w-full resize-y rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[14px] leading-[1.6] text-[var(--text)] placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] ${focusRing}`}
              />
              <p className="m-0 mt-1.5 text-right text-[12px] text-[var(--muted)]">
                {bio.bio.length} / {BIO_MAX}
              </p>
            </div>
          </Section>

          <Section
            id="profil-competences"
            title="Compétences"
            description="Jusqu’à 10 compétences, utilisées pour vos recommandations."
            dirty={dirty.skills}
            saving={saving.skills}
            error={errors.skills}
            onDismissError={() => setErrors((value) => ({ ...value, skills: null }))}
            onSave={() => saveSection("skills", { skills: skills.skills })}
          >
            <SkillTagEditor
              inputId="profile-skills"
              values={skills.skills}
              onChange={(value) => setField("skills", "skills", value)}
              suggestions={SKILL_SUGGESTIONS}
            />
          </Section>

          <Section
            id="profil-liens"
            title="Liens"
            description="Tous facultatifs."
            dirty={dirty.links}
            saving={saving.links}
            error={errors.links}
            onDismissError={() => setErrors((value) => ({ ...value, links: null }))}
            invalidReason={Object.values(linkErrors).some(Boolean) ? "Corrigez les adresses invalides" : undefined}
            onSave={() =>
              saveSection("links", {
                links: Object.fromEntries(LINKS.map((link) => [link.key, links[link.key].trim()])),
              })
            }
          >
            {LINKS.map((link) => {
              const Icon = link.icon;
              const value = links[link.key];
              const error = linkErrors[link.key];
              const valid = value.trim() && !error;
              return (
                <Field key={link.key} label={link.label} htmlFor={`profile-link-${link.key}`} error={error}>
                  <div className="relative">
                    <Icon size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      id={`profile-link-${link.key}`}
                      type="url"
                      inputMode="url"
                      className={`${input} pl-10! pr-10`}
                      placeholder={link.placeholder}
                      value={value}
                      aria-invalid={error ? "true" : undefined}
                      aria-describedby={error ? `profile-link-${link.key}-error` : undefined}
                      onChange={(event) => setField("links", link.key, event.target.value)}
                    />
                    {valid && (
                      <Check
                        size={16}
                        aria-label="Adresse valide"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--success,#2e7d5b)]"
                      />
                    )}
                  </div>
                </Field>
              );
            })}
          </Section>

          <Section
            id="profil-cv"
            title="CV"
            description="Joint à vos candidatures. PDF uniquement, 5 Mo maximum."
            dirty={Boolean(cvFile)}
            saving={saving.cv}
            error={errors.cv}
            onDismissError={() => setErrors((value) => ({ ...value, cv: null }))}
            onSave={showCvDropzone ? uploadCv : undefined}
          >
            {me.cvFileName && !cvReplacing && (
              <div className="flex flex-col gap-3 rounded-[4px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--danger)]">
                  <FileText size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[13px] text-[var(--text)]">{me.cvFileName}</strong>
                  <span className="text-[12px] text-[var(--muted)]">
                    {formatBytes(me.cvSize)} · déposé le {formatDate(me.cvUploadedAt)}
                  </span>
                </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton variant="secondary" onClick={downloadCv}>
                    <Download size={15} aria-hidden="true" />
                    Télécharger
                  </ActionButton>
                  <ActionButton variant="secondary" onClick={() => setCvReplacing(true)}>
                    <RefreshCw size={15} aria-hidden="true" />
                    Remplacer
                  </ActionButton>
                  <ActionButton variant="danger" loading={saving.cv} onClick={() => setConfirmCvDelete(true)}>
                    <Trash2 size={15} aria-hidden="true" />
                    Supprimer
                  </ActionButton>
                </div>
              </div>
            )}
            {showCvDropzone && (
              <>
                <FileDropzone
                  label="Glissez votre CV ici"
                  hint="PDF uniquement, 5 Mo maximum"
                  accept="application/pdf,.pdf"
                  mimeTypes={["application/pdf"]}
                  extensions={[".pdf"]}
                  maxBytes={CV_MAX}
                  typeError="Seuls les fichiers PDF sont acceptés."
                  sizeError="Fichier trop volumineux (5 Mo maximum)."
                  file={cvFile}
                  onFile={setCvFile}
                  progress={cvProgress}
                  busy={Boolean(saving.cv)}
                />
                {cvReplacing && !saving.cv && (
                  <button
                    type="button"
                    className={`${linkButton} self-start`}
                    onClick={() => {
                      setCvReplacing(false);
                      setCvFile(null);
                    }}
                  >
                    Annuler le remplacement
                  </button>
                )}
              </>
            )}
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCvDelete}
        title="Supprimer votre CV ?"
        body="Il ne sera plus joint à vos prochaines candidatures."
        confirmLabel="Supprimer"
        onConfirm={removeCv}
        onCancel={() => setConfirmCvDelete(false)}
      />
      {toast && <Toast message={toast} onClose={closeToast} />}
    </section>
  );
}
