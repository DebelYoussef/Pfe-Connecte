import {
  BriefcaseBusiness,
  Camera,
  Check,
  GitBranch,
  Globe,
  Lock,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import ErrorBanner, { getErrorBanner } from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import {
  createAvatarUploadUrl,
  uploadToPresignedPost,
} from "../../services";
import {
  getTeacherMe,
  updateTeacherExpertise,
  updateTeacherMe,
} from "../../services.teacher";
import ActionButton from "../student/parts/ActionButton";
import RetryBanner from "../student/parts/RetryBanner";
import SkillTagEditor, {
  normalizeSkill,
} from "../student/parts/SkillTagEditor";
import useUnsavedWarning from "../student/parts/useUnsavedWarning";
import {
  card,
  fieldError,
  fieldHint,
  fieldLabel,
  focusRing,
  input,
  inputReadOnly,
  linkButton,
  sectionTitle,
} from "../student/parts/ui";

const EXPERTISE_SUGGESTIONS = [
  "python",
  "java",
  "aws",
  "docker",
  "react",
  "sql",
  "spring",
  "linux",
  "kubernetes",
  "django",
  "typescript",
  "git",
  "mongodb",
  "node",
  "angular",
];
const LINKS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: BriefcaseBusiness,
    placeholder: "https://www.linkedin.com/in/votre-profil",
    host: "linkedin.com",
  },
  {
    key: "github",
    label: "GitHub",
    icon: GitBranch,
    placeholder: "https://github.com/votre-pseudo",
    host: "github.com",
  },
  {
    key: "portfolio",
    label: "Site web",
    icon: Globe,
    placeholder: "https://votre-site.tn",
  },
];
const AVATAR_MAX = 2 * 1024 * 1024;
const BIO_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formsFrom(me) {
  return {
    identity: {
      firstName: me.firstName || "",
      lastName: me.lastName || "",
      contactEmail: me.contactEmail || me.email || "",
    },
    expertise: (me.expertise || []).map(normalizeSkill),
    bio: me.bio || "",
    links: Object.fromEntries(
      LINKS.map((link) => [link.key, me.links?.[link.key] || ""]),
    ),
  };
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function getLinkError(link, value) {
  if (!value.trim()) return "";
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return "Saisissez une adresse complète commençant par https://";
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return "L’adresse doit commencer par https://";
  }
  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
  if (
    link.host &&
    hostname !== link.host &&
    !hostname.endsWith(`.${link.host}`)
  ) {
    return `L’adresse doit pointer vers ${link.host}`;
  }
  return "";
}

function Field({ label, htmlFor, hint, error, children }) {
  const errorId = `${htmlFor}-error`;
  return (
    <div>
      <label htmlFor={htmlFor} className={fieldLabel}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className={fieldError}>
          {error}
        </p>
      ) : (
        hint && <p className={fieldHint}>{hint}</p>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  dirty,
  saving,
  error,
  onDismissError,
  onSave,
  invalidReason,
  children,
}) {
  const disabledReason = !dirty
    ? "Aucune modification à enregistrer"
    : invalidReason;
  return (
    <section
      id={id}
      className={`${card} scroll-mt-24 p-6`}
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className={sectionTitle}>
        {title}
      </h2>
      {error && (
        <div className="mt-4">
          <ErrorBanner
            title={error.title}
            message={error.message}
            onClose={onDismissError}
          />
        </div>
      )}
      <div className="mt-5 flex flex-col gap-4">{children}</div>
      <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
        <ActionButton
          loading={saving}
          disabledReason={disabledReason}
          onClick={onSave}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </ActionButton>
      </div>
    </section>
  );
}

export default function TeacherProfile() {
  const [me, setMe] = useState(null);
  const [forms, setForms] = useState(null);
  const [base, setBase] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputId = useId();

  const load = useCallback(() => {
    setLoadError(null);
    return getTeacherMe()
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

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  const dirty =
    forms && base
      ? Object.fromEntries(
          Object.keys(forms).map((key) => [key, !same(forms[key], base[key])]),
        )
      : {};
  const anyDirty = Object.values(dirty).some(Boolean);
  useUnsavedWarning(anyDirty);

  const setField = (section, key, value) =>
    setForms((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));

  async function saveSection(section, payload) {
    setSaving((current) => ({ ...current, [section]: true }));
    setErrors((current) => ({ ...current, [section]: null }));
    try {
      const updated =
        section === "expertise"
          ? await updateTeacherExpertise(payload.expertise)
          : await updateTeacherMe(payload);
      setMe(updated);
      const fresh = formsFrom(updated);
      setBase((current) => ({ ...current, [section]: fresh[section] }));
      setForms((current) => ({ ...current, [section]: fresh[section] }));
      setToast("Profil mis à jour");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [section]: getErrorBanner(error),
      }));
    } finally {
      setSaving((current) => ({ ...current, [section]: false }));
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

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarBusy(true);
    try {
      const presigned = await createAvatarUploadUrl();
      await uploadToPresignedPost(presigned, file);
      setMe(await getTeacherMe());
      setAvatarPreview(null);
      setToast("Photo mise à jour");
    } catch (error) {
      setAvatarPreview(null);
      setAvatarError(getErrorBanner(error).message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarError("");
    setAvatarBusy(true);
    try {
      const updated = await updateTeacherMe({ avatarUrl: null });
      setMe(updated);
      setAvatarPreview(null);
      setToast("Photo supprimée");
    } catch (error) {
      setAvatarError(getErrorBanner(error).message);
    } finally {
      setAvatarBusy(false);
    }
  }

  function goTo(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target
      .querySelector("input:not([readonly]), textarea, button")
      ?.focus({ preventScroll: true });
  }

  const closeToast = useCallback(() => setToast(""), []);

  if (loadError && !me) {
    return (
      <section className="student-page">
        <PageHeader eyebrow="Mon compte" title="Mon profil" />
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
  }

  if (!me || !forms) {
    return (
      <section className="student-page" aria-busy="true">
        <PageHeader eyebrow="Mon compte" title="Mon profil" />
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton />
          <div className="flex flex-col gap-5">
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        </div>
      </section>
    );
  }

  const fullName =
    [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email || "";
  const initials =
    [me.firstName, me.lastName]
      .filter(Boolean)
      .map((value) => value[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    me.email?.[0]?.toUpperCase() ||
    "U";
  const avatar = avatarPreview || me.avatarUrl;
  const expertise = forms.expertise;
  const { identity, bio, links } = forms;
  const firstNameError = !identity.firstName.trim()
    ? "Le prénom est obligatoire."
    : "";
  const lastNameError = !identity.lastName.trim()
    ? "Le nom est obligatoire."
    : "";
  const contactError =
    identity.contactEmail && !EMAIL_RE.test(identity.contactEmail)
      ? "Saisissez une adresse e-mail valide."
      : "";
  const linkErrors = Object.fromEntries(
    LINKS.map((link) => [link.key, getLinkError(link, links[link.key])]),
  );

  const checklist = [
    { done: Boolean(me.avatarUrl), label: "Ajouter une photo", target: "profil-identite" },
    { done: Boolean(me.bio?.trim()), label: "Rédiger une présentation", target: "profil-presentation" },
    { done: (me.expertise || []).length > 0, label: "Ajouter des domaines d’expertise", target: "profil-expertise" },
    {
      done: LINKS.some(
        (link) =>
          me.links?.[link.key]?.trim() &&
          !getLinkError(link, me.links[link.key]),
      ),
      label: "Ajouter un lien",
      target: "profil-liens",
    },
  ];
  const completion = Math.round(
    (checklist.filter((item) => item.done).length / checklist.length) * 100,
  );
  const missing = checklist.filter((item) => !item.done);

  return (
    <section className="student-page">
      <PageHeader
        eyebrow="Mon compte"
        title="Mon profil"
        subtitle="Gérez les informations de votre compte enseignant."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          id="profil-identite"
          className={`${card} flex flex-col items-center p-6 text-center lg:sticky lg:top-[100px]`}
        >
          <div className="relative h-[120px] w-[120px] overflow-hidden rounded-[4px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]">
            {avatar ? (
              <img
                src={avatar}
                alt={`Photo de ${fullName}`}
                className="h-full w-full object-cover"
              />
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
            aria-label="Choisir une photo de profil"
            tabIndex={-1}
            disabled={avatarBusy}
            onChange={(event) => {
              changeAvatar(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              className={linkButton}
              disabled={avatarBusy}
              onClick={() => document.getElementById(avatarInputId)?.click()}
            >
              <Camera size={13} aria-hidden="true" />
              Changer la photo
            </button>
            {avatar && (
              <button
                type="button"
                className={`${linkButton} text-[var(--danger)]!`}
                disabled={avatarBusy}
                onClick={removeAvatar}
              >
                Supprimer
              </button>
            )}
          </div>
          <p className="m-0 mt-1 text-[11px] text-[var(--muted)]">
            JPG ou PNG, 2 Mo maximum
          </p>
          {avatarError && (
            <p role="alert" className={fieldError}>
              {avatarError}
            </p>
          )}

          <h2 className={`${sectionTitle} mt-5`}>{fullName}</h2>
          <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">
            {["Enseignant encadrant", me.etab].filter(Boolean).join(" · ")}
          </p>
          <p className="m-0 mt-1 break-all text-[12px] text-[var(--text)]">
            {me.email}
          </p>

          <div className="mt-6 w-full border-t border-[var(--border)] pt-5 text-left">
            <div className="flex items-baseline justify-between">
              <strong className="text-[13px] text-[var(--text)]">
                Profil complété
              </strong>
              <strong className="font-['Source_Serif_4',Georgia,serif] text-[20px] text-[var(--primary)]">
                {completion} %
              </strong>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-[var(--border)]"
              role="progressbar"
              aria-label="Profil complété"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <span
                className="block h-full bg-[var(--primary)] transition-[width] duration-300"
                style={{ width: `${completion}%` }}
              />
            </div>
            {missing.length > 0 ? (
              <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                {missing.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      className={linkButton}
                      onClick={() => goTo(item.target)}
                    >
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
          </div>
        </aside>

        <div className="flex flex-col gap-5">
          <Section
            id="profil-infos"
            title="Informations personnelles"
            dirty={dirty.identity}
            saving={saving.identity}
            error={errors.identity}
            onDismissError={() =>
              setErrors((current) => ({ ...current, identity: null }))
            }
            invalidReason={
              firstNameError || lastNameError || contactError || undefined
            }
            onSave={() =>
              saveSection("identity", {
                firstName: identity.firstName.trim(),
                lastName: identity.lastName.trim(),
                contactEmail:
                  identity.contactEmail.trim() === me.email
                    ? ""
                    : identity.contactEmail.trim(),
              })
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Prénom"
                htmlFor="teacher-profile-first-name"
                error={dirty.identity ? firstNameError : ""}
              >
                <input
                  id="teacher-profile-first-name"
                  className={input}
                  value={identity.firstName}
                  autoComplete="given-name"
                  aria-invalid={
                    dirty.identity && firstNameError ? "true" : undefined
                  }
                  aria-describedby={
                    dirty.identity && firstNameError
                      ? "teacher-profile-first-name-error"
                      : undefined
                  }
                  onChange={(event) =>
                    setField("identity", "firstName", event.target.value)
                  }
                />
              </Field>
              <Field
                label="Nom"
                htmlFor="teacher-profile-last-name"
                error={dirty.identity ? lastNameError : ""}
              >
                <input
                  id="teacher-profile-last-name"
                  className={input}
                  value={identity.lastName}
                  autoComplete="family-name"
                  aria-invalid={
                    dirty.identity && lastNameError ? "true" : undefined
                  }
                  aria-describedby={
                    dirty.identity && lastNameError
                      ? "teacher-profile-last-name-error"
                      : undefined
                  }
                  onChange={(event) =>
                    setField("identity", "lastName", event.target.value)
                  }
                />
              </Field>
            </div>
            <Field
              label="E-mail de connexion"
              htmlFor="teacher-profile-login-email"
              hint="Utilisé pour vous connecter, non modifiable."
            >
              <div className="relative">
                <input
                  id="teacher-profile-login-email"
                  className={`${input} ${inputReadOnly} pr-10`}
                  value={me.email || ""}
                  readOnly
                />
                <Lock
                  size={15}
                  aria-hidden="true"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
              </div>
            </Field>
            <Field
              label="E-mail de contact"
              htmlFor="teacher-profile-contact-email"
              error={contactError}
            >
              <input
                id="teacher-profile-contact-email"
                type="email"
                className={input}
                value={identity.contactEmail}
                autoComplete="email"
                aria-invalid={contactError ? "true" : undefined}
                aria-describedby={
                  contactError
                    ? "teacher-profile-contact-email-error"
                    : undefined
                }
                onChange={(event) =>
                  setField("identity", "contactEmail", event.target.value)
                }
              />
              {identity.contactEmail !== me.email && (
                <button
                  type="button"
                  className={`${linkButton} mt-2`}
                  onClick={() =>
                    setField("identity", "contactEmail", me.email || "")
                  }
                >
                  Utiliser l’e-mail de connexion
                </button>
              )}
            </Field>
            <Field
              label="Établissement"
              htmlFor="teacher-profile-etab"
              hint="Contactez votre responsable pour le modifier."
            >
              <div className="relative">
                <input
                  id="teacher-profile-etab"
                  className={`${input} ${inputReadOnly} pr-10`}
                  value={me.etab || ""}
                  readOnly
                />
                <Lock
                  size={15}
                  aria-hidden="true"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
              </div>
            </Field>
          </Section>

          <Section
            id="profil-expertise"
            title="Domaines d’expertise"
            dirty={dirty.expertise}
            saving={saving.expertise}
            error={errors.expertise}
            onDismissError={() =>
              setErrors((current) => ({ ...current, expertise: null }))
            }
            onSave={() =>
              saveSection("expertise", { expertise })
            }
          >
            <Field
              label="Vos domaines"
              htmlFor="teacher-profile-expertise"
            >
              <SkillTagEditor
                inputId="teacher-profile-expertise"
                values={expertise}
                onChange={(value) =>
                  setForms((current) => ({
                    ...current,
                    expertise: value,
                  }))
                }
                suggestions={EXPERTISE_SUGGESTIONS}
                max={10}
                maxLabel="domaines"
              />
            </Field>
          </Section>

          <Section
            id="profil-presentation"
            title="Présentation"
            dirty={dirty.bio}
            saving={saving.bio}
            error={errors.bio}
            onDismissError={() =>
              setErrors((current) => ({ ...current, bio: null }))
            }
            onSave={() =>
              saveSection("bio", { bio: bio.trim() })
            }
          >
            <div>
              <label
                htmlFor="teacher-profile-bio"
                className="sr-only"
              >
                Présentation
              </label>
              <textarea
                id="teacher-profile-bio"
                value={bio}
                maxLength={BIO_MAX}
                onChange={(event) =>
                  setForms((current) => ({
                    ...current,
                    bio: event.target.value,
                  }))
                }
                placeholder="Présentez votre parcours et vos domaines d’accompagnement."
                className={`block min-h-[130px] w-full resize-y rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[14px] leading-[1.6] text-[var(--text)] placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] ${focusRing}`}
              />
              <p className="m-0 mt-1.5 text-right text-[12px] text-[var(--muted)]">
                {bio.length} / {BIO_MAX}
              </p>
            </div>
          </Section>

          <Section
            id="profil-liens"
            title="Liens"
            dirty={dirty.links}
            saving={saving.links}
            error={errors.links}
            onDismissError={() =>
              setErrors((current) => ({ ...current, links: null }))
            }
            invalidReason={
              Object.values(linkErrors).some(Boolean)
                ? "Corrigez les adresses invalides"
                : undefined
            }
            onSave={() =>
              saveSection("links", {
                links: Object.fromEntries(
                  LINKS.map((link) => [
                    link.key,
                    links[link.key].trim(),
                  ]),
                ),
              })
            }
          >
            {LINKS.map((link) => {
              const Icon = link.icon;
              const value = links[link.key];
              const error = linkErrors[link.key];
              const valid = value.trim() && !error;
              const id = `teacher-profile-link-${link.key}`;
              return (
                <Field
                  key={link.key}
                  label={link.label}
                  htmlFor={id}
                  error={error}
                >
                  <div className="relative">
                    <Icon
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    />
                    <input
                      id={id}
                      type="url"
                      inputMode="url"
                      className={`${input} pl-10! pr-10`}
                      placeholder={link.placeholder}
                      value={value}
                      aria-invalid={error ? "true" : undefined}
                      aria-describedby={error ? `${id}-error` : undefined}
                      onChange={(event) =>
                        setField("links", link.key, event.target.value)
                      }
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
        </div>
      </div>

      <p className="m-0 mt-5 text-[12px] text-[var(--muted)]">
        Votre nom et vos domaines d’expertise sont visibles par les étudiants
        de votre établissement.
      </p>
      {toast && <Toast message={toast} onClose={closeToast} />}
    </section>
  );
}
