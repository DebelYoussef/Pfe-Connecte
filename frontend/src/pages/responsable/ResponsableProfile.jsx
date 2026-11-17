import { Camera, Check, Globe, Lock, BriefcaseBusiness } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import ErrorBanner, { getErrorBanner } from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import ActionButton from "../student/parts/ActionButton";
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
import { getUser } from "../../auth";
import { getMe, updateMe } from "../../services.responsable";

const AVATAR_MAX = 2 * 1024 * 1024;
const BIO_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const institutionLabel = (etab) =>
  etab === "ETAB2" ? "Institut B" : "Institut A";

const LINKS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: BriefcaseBusiness,
    placeholder: "https://www.linkedin.com/in/votre-profil",
  },
  {
    key: "website",
    label: "Site web",
    icon: Globe,
    placeholder: "https://votre-site.tn",
  },
];

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function formsFrom(profile) {
  return {
    identity: {
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      contactEmail: profile.contactEmail || profile.email || "",
    },
    bio: { bio: profile.bio || "" },
    links: {
      linkedin: profile.links?.linkedin || "",
      website: profile.links?.website || "",
    },
  };
}

function linkError(value) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return "L’adresse doit commencer par http:// ou https://.";
    }
  } catch {
    return "Saisissez une adresse complète commençant par https://.";
  }
  return "";
}

function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={fieldLabel}>{label}</label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className={fieldError}>{error}</p>
      ) : hint ? (
        <p className={fieldHint}>{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  dirty,
  saving,
  error,
  onSave,
  invalidReason,
  children,
}) {
  return (
    <section id={id} className={`${card} scroll-mt-24 p-6`} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={sectionTitle}>{title}</h3>
      {error && (
        <div className="mt-4">
          <ErrorBanner
            title={error.title}
            message={error.message}
            onRetry={onSave}
          />
        </div>
      )}
      <div className="mt-5 flex flex-col gap-4">{children}</div>
      <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
        <ActionButton
          loading={saving}
          disabledReason={!dirty ? "Aucune modification à enregistrer" : invalidReason}
          onClick={onSave}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </ActionButton>
      </div>
    </section>
  );
}

export default function ResponsableProfile() {
  const [me, setMe] = useState(null);
  const [forms, setForms] = useState(null);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getMe();
      setMe(profile);
      const next = formsFrom(profile);
      setBase(next);
      setForms(next);
      setAvatarPreview(profile.avatarUrl || "");
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(
    () => () => {
      if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  const dirty = forms && base
    ? Object.fromEntries(
        Object.keys(forms).map((key) => [key, !same(forms[key], base[key])]),
      )
    : {};
  const anyDirty = Object.values(dirty).some(Boolean) || avatarBusy;
  useUnsavedWarning(anyDirty);

  function setField(section, key, value) {
    setForms((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  }

  async function saveSection(section) {
    setSaving((current) => ({ ...current, [section]: true }));
    setErrors((current) => ({ ...current, [section]: null }));
    try {
      const payload =
        section === "identity"
          ? {
              firstName: forms.identity.firstName.trim(),
              lastName: forms.identity.lastName.trim(),
              contactEmail: forms.identity.contactEmail.trim(),
            }
          : section === "bio"
            ? { bio: forms.bio.bio.trim() }
            : { links: { ...forms.links } };
      const updated = await updateMe(payload);
      const merged = { ...updated, email: updated.email || me.email };
      setMe(merged);
      const fresh = formsFrom(merged);
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
    setAvatarError("");
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setAvatarError("Seules les images JPG ou PNG sont acceptées.");
      return;
    }
    if (file.size > AVATAR_MAX) {
      setAvatarError("Image trop volumineuse (2 Mo maximum).");
      return;
    }
    setAvatarBusy(true);
    try {
      const preview = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("L’image n’a pas pu être lue."));
        reader.readAsDataURL(file);
      });
      const updated = await updateMe({ avatarUrl: preview });
      setMe(updated);
      setAvatarPreview(preview);
      setToast("Profil mis à jour");
    } catch (error) {
      setAvatarError(error?.message || "La photo n’a pas pu être enregistrée.");
    } finally {
      setAvatarBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="student-page">
        <PageHeader eyebrow="Mon compte" title="Mon profil" />
        <Skeleton className="responsable-row-skeleton" />
      </section>
    );
  }

  if (loadError && !me) {
    const error = getErrorBanner(loadError);
    return (
      <section className="student-page">
        <PageHeader eyebrow="Mon compte" title="Mon profil" />
        <ErrorBanner title={error.title} message={error.message} onRetry={() => void load()} />
      </section>
    );
  }

  const { identity, bio, links } = forms;
  const sessionUser = getUser() || {};
  const fullName =
    [me.firstName, me.lastName].filter(Boolean).join(" ") ||
    me.email ||
    "Utilisateur";
  const initials =
    [me.firstName, me.lastName]
      .filter(Boolean)
      .map((value) => value[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    me.email?.[0]?.toUpperCase() ||
    "U";
  const firstNameError = !identity.firstName.trim()
    ? "Le prénom est obligatoire."
    : "";
  const lastNameError = !identity.lastName.trim()
    ? "Le nom est obligatoire."
    : "";
  const contactEmailError =
    identity.contactEmail && !EMAIL_RE.test(identity.contactEmail)
      ? "Saisissez une adresse e-mail valide."
      : "";
  const linkErrors = Object.fromEntries(
    LINKS.map((link) => [link.key, linkError(links[link.key])]),
  );
  const checklist = [
    { done: Boolean(me.avatarUrl), label: "Ajouter une photo", target: "profil-identite" },
    { done: Boolean(me.bio?.trim()), label: "Rédiger une présentation", target: "profil-presentation" },
    {
      done: LINKS.some((link) =>
        links[link.key]?.trim() && !linkError(links[link.key]),
      ),
      label: "Ajouter au moins un lien",
      target: "profil-liens",
    },
  ];
  const completion = Math.round(
    (checklist.filter((item) => item.done).length / checklist.length) * 100,
  );

  function goTo(target) {
    const element = document.getElementById(target);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="student-page">
      <PageHeader eyebrow="Mon compte" title="Mon profil" />
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          id="profil-identite"
          className={`${card} flex flex-col items-center p-6 text-center lg:sticky lg:top-[100px]`}
        >
          <div className="relative h-[120px] w-[120px] overflow-hidden rounded-[4px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]">
            {avatarPreview ? (
              <img
                src={avatarPreview}
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
            tabIndex={-1}
            disabled={avatarBusy}
            onChange={(event) => {
              void changeAvatar(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              className={`${linkButton}`}
              disabled={avatarBusy}
              title={avatarBusy ? "Enregistrement de la photo en cours" : "Changer la photo"}
              onClick={() => document.getElementById(avatarInputId)?.click()}
            >
              <Camera size={13} aria-hidden="true" />
              Changer la photo
            </button>
            {avatarPreview && (
              <button
                type="button"
                className={`${linkButton} text-[var(--danger)]!`}
                disabled={avatarBusy}
                title={avatarBusy ? "Suppression temporairement indisponible" : "Supprimer la photo"}
                onClick={async () => {
                  setAvatarBusy(true);
                  try {
                    const updated = await updateMe({ avatarUrl: null });
                    setMe(updated);
                    setAvatarPreview("");
                    setToast("Profil mis à jour");
                  } catch (error) {
                    setAvatarError(error?.message || "La photo n’a pas pu être supprimée.");
                  } finally {
                    setAvatarBusy(false);
                  }
                }}
              >
                Supprimer
              </button>
            )}
          </div>
          <p className="m-0 mt-1 text-[11px] text-[var(--muted)]">
            JPG ou PNG, 2 Mo maximum
          </p>
          {avatarError && <p role="alert" className={fieldError}>{avatarError}</p>}
          <h3 className="m-0 mt-4 text-[18px]! font-semibold">{fullName}</h3>
          <p className="m-0 mt-1 text-[12px] text-[var(--muted)]">
            Responsable · {institutionLabel(me.etab || sessionUser.etab)}
          </p>
          <p className="m-0 mt-2 break-all text-[12px] text-[var(--muted)]">
            {me.email || sessionUser.email}
          </p>
          <div className="mt-5 w-full border-t border-[var(--border)] pt-4 text-left">
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-[12px]">Complétude</strong>
              <span className="text-[12px] text-[var(--muted)]">{completion} %</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <span
                className="block h-full bg-[var(--primary)]"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {checklist.filter((item) => !item.done).map((item) => (
                <button
                  type="button"
                  className={linkButton}
                  key={item.label}
                  onClick={() => goTo(item.target)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <Section
            id="profil-informations"
            title="Informations personnelles"
            dirty={dirty.identity}
            saving={saving.identity}
            error={errors.identity}
            invalidReason={
              firstNameError || lastNameError || contactEmailError
                ? "Corrigez les champs obligatoires ou l’e-mail"
                : undefined
            }
            onSave={() => void saveSection("identity")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="responsable-profile-first-name" error={firstNameError}>
                <input
                  id="responsable-profile-first-name"
                  className={input}
                  value={identity.firstName}
                  onChange={(event) => setField("identity", "firstName", event.target.value)}
                />
              </Field>
              <Field label="Nom" htmlFor="responsable-profile-last-name" error={lastNameError}>
                <input
                  id="responsable-profile-last-name"
                  className={input}
                  value={identity.lastName}
                  onChange={(event) => setField("identity", "lastName", event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="E-mail de connexion"
              htmlFor="responsable-profile-login-email"
              hint="Utilisé pour vous connecter, non modifiable."
            >
              <div className="relative">
                <Lock size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  id="responsable-profile-login-email"
                  className={`${input} ${inputReadOnly} pl-10!`}
                  value={me.email || sessionUser.email || ""}
                  readOnly
                  title="Adresse utilisée pour la connexion"
                />
              </div>
            </Field>
            <Field
              label="E-mail de contact"
              htmlFor="responsable-profile-contact-email"
              hint="Adresse facultative utilisée pour les échanges."
              error={contactEmailError}
            >
              <input
                id="responsable-profile-contact-email"
                type="email"
                className={input}
                value={identity.contactEmail}
                onChange={(event) => setField("identity", "contactEmail", event.target.value)}
              />
            </Field>
            {identity.contactEmail !== (me.email || sessionUser.email) && (
              <button
                type="button"
                className={linkButton}
                onClick={() => setField("identity", "contactEmail", me.email || sessionUser.email || "")}
              >
                Réinitialiser avec l’e-mail de connexion
              </button>
            )}
            <Field
              label="Établissement"
              htmlFor="responsable-profile-etab"
              hint="Contactez l’administrateur pour le modifier."
            >
              <input
                id="responsable-profile-etab"
                className={`${input} ${inputReadOnly}`}
                value={institutionLabel(me.etab || sessionUser.etab)}
                readOnly
                title="Établissement lié au compte"
              />
            </Field>
          </Section>

          <Section
            id="profil-presentation"
            title="Présentation"
            dirty={dirty.bio}
            saving={saving.bio}
            error={errors.bio}
            onSave={() => void saveSection("bio")}
          >
            <textarea
              className={`${input} min-h-[130px] resize-y`}
              value={bio.bio}
              maxLength={BIO_MAX}
              onChange={(event) => setField("bio", "bio", event.target.value)}
              placeholder="Présentez votre rôle et votre parcours."
            />
            <p className="m-0 text-right text-[12px] text-[var(--muted)]">
              {bio.bio.length} / {BIO_MAX}
            </p>
          </Section>

          <Section
            id="profil-liens"
            title="Liens"
            dirty={dirty.links}
            saving={saving.links}
            error={errors.links}
            invalidReason={
              Object.values(linkErrors).some(Boolean)
                ? "Corrigez les adresses invalides"
                : undefined
            }
            onSave={() => void saveSection("links")}
          >
            {LINKS.map((link) => {
              const Icon = link.icon;
              const value = links[link.key];
              const error = linkErrors[link.key];
              const valid = value.trim() && !error;
              const id = `responsable-profile-link-${link.key}`;
              return (
                <Field key={link.key} label={link.label} htmlFor={id} error={error}>
                  <div className="relative">
                    <Icon size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      id={id}
                      type="url"
                      inputMode="url"
                      className={`${input} pl-10! pr-10`}
                      placeholder={link.placeholder}
                      value={value}
                      onChange={(event) => setField("links", link.key, event.target.value)}
                    />
                    {valid && (
                      <Check
                        size={16}
                        aria-label="Adresse valide"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--primary)]"
                      />
                    )}
                  </div>
                </Field>
              );
            })}
          </Section>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
