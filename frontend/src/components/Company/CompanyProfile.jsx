import {
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronDown,
  Globe,
  Lock,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import ErrorBanner, { getErrorBanner } from "../ErrorBanner";
import PageHeader from "../ui/PageHeader";
import Skeleton from "../ui/Skeleton";
import Toast from "../ui/Toast";
import { getMe, updateMe } from "../../services.company";
import ActionButton from "../../pages/student/parts/ActionButton";
import useUnsavedWarning from "../../pages/student/parts/useUnsavedWarning";
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
} from "../../pages/student/parts/ui";

const SECTORS = [
  "Informatique",
  "Industrie",
  "Santé",
  "Finance",
  "Commerce",
  "Éducation",
  "Autre",
];
const COMPANY_SIZES = ["1-10", "11-50", "51-200", "200+"];
const GOVERNORATES = [
  "Tunis",
  "Sousse",
  "Sfax",
  "Monastir",
  "Nabeul",
  "Gabès",
  "Gafsa",
  "Bizerte",
];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const disabledField =
  "disabled:cursor-not-allowed disabled:bg-[var(--bg)] disabled:text-[var(--muted)] disabled:hover:border-[var(--border)]";

function formsFrom(me) {
  return {
    contact: {
      firstName: me.firstName || "",
      lastName: me.lastName || "",
      contactEmail: me.contactEmail || me.email || "",
    },
    company: {
      companyName: me.companyName || "",
      sector: me.sector || "",
      size: me.size || "",
      gouvernorat: me.gouvernorat || "",
    },
    presentation: { bio: me.bio || "" },
    links: {
      website: me.links?.website || "",
      linkedin: me.links?.linkedin || "",
    },
  };
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function linkError(value, isLinkedin = false) {
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
    isLinkedin &&
    hostname !== "linkedin.com" &&
    !hostname.endsWith(".linkedin.com")
  ) {
    return "L’adresse doit pointer vers linkedin.com.";
  }
  return "";
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Le logo n’a pas pu être lu."));
    };
    reader.onerror = () => reject(new Error("Le logo n’a pas pu être lu."));
    reader.readAsDataURL(file);
  });
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

function SelectField({ id, label, value, options, onChange, disabled }) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          className={`${input} ${disabledField} appearance-none pr-10`}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choisir…</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
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

function Section({
  id,
  title,
  description,
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
      {description && (
        <p className="mb-0 mt-2 text-[13px] leading-[1.6] text-[var(--muted)]">
          {description}
        </p>
      )}
      {error && (
        <div className="mt-4">
          <ErrorBanner
            title={error.title}
            message={error.message}
            onClose={onDismissError}
            onRetry={onSave}
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

export default function CompanyProfile() {
  const [me, setMe] = useState(null);
  const [forms, setForms] = useState(null);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoInputId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getMe();
      const next = formsFrom(profile);
      setMe(profile);
      setBase(next);
      setForms(next);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () => () => {
      if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  const dirty =
    forms && base
      ? Object.fromEntries(
          Object.keys(forms).map((key) => [key, !same(forms[key], base[key])]),
        )
      : {};
  const anyDirty = Object.values(dirty).some(Boolean);
  useUnsavedWarning(anyDirty || logoBusy);

  function setField(section, key, value) {
    setForms((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  }

  async function saveSection(section, payload) {
    setSaving((current) => ({ ...current, [section]: true }));
    setErrors((current) => ({ ...current, [section]: null }));
    try {
      const updated = await updateMe(payload);
      const fresh = formsFrom(updated);
      setMe(updated);
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

  async function changeLogo(file) {
    if (!file) return;
    setLogoError("");
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setLogoError("Seules les images JPG ou PNG sont acceptées.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("Image trop volumineuse (2 Mo maximum).");
      return;
    }

    let preview;
    try {
      preview = URL.createObjectURL(file);
    } catch {
      setLogoError("L’aperçu du logo n’a pas pu être affiché.");
      return;
    }
    setLogoPreview(preview);
    setLogoBusy(true);
    try {
      const avatarUrl = await readAsDataUrl(file);
      const updated = await updateMe({ avatarUrl });
      setMe(updated);
      setLogoPreview("");
      setToast("Profil mis à jour");
    } catch (error) {
      setLogoPreview("");
      setLogoError(getErrorBanner(error).message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    setLogoError("");
    setLogoBusy(true);
    try {
      setMe(await updateMe({ avatarUrl: null }));
      setLogoPreview("");
      setToast("Profil mis à jour");
    } catch (error) {
      setLogoError(getErrorBanner(error).message);
    } finally {
      setLogoBusy(false);
    }
  }

  function goTo(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target
      .querySelector("input:not([readonly]):not([type=file]), select, textarea, button")
      ?.focus({ preventScroll: true });
  }

  async function retryLoad() {
    setRetrying(true);
    await load();
    setRetrying(false);
  }

  const closeToast = useCallback(() => setToast(""), []);

  if (loadError && !me) {
    const error = getErrorBanner(loadError);
    return (
      <section className="student-page">
        <PageHeader eyebrow="Mon compte" title="Mon profil" />
        <ErrorBanner
          title={error.title}
          message={error.message}
          onRetry={retryLoad}
        />
        {retrying && <span className="sr-only">Chargement du profil…</span>}
      </section>
    );
  }

  if (loading || !me || !forms) {
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

  const personalName = [me.firstName, me.lastName].filter(Boolean).join(" ");
  const companyName = me.companyName?.trim() || personalName || me.email || "";
  const initials =
    (me.companyName?.trim() || personalName || me.email || "?")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const logo = logoPreview || me.avatarUrl;
  const { contact, company, presentation, links } = forms;
  const firstNameError = !contact.firstName.trim()
    ? "Le prénom est obligatoire."
    : "";
  const lastNameError = !contact.lastName.trim()
    ? "Le nom est obligatoire."
    : "";
  const contactEmailError =
    contact.contactEmail && !EMAIL_RE.test(contact.contactEmail)
      ? "Saisissez une adresse e-mail valide."
      : "";
  const companyNameError = !company.companyName.trim()
    ? "Le nom de l’entreprise est obligatoire."
    : "";
  const websiteError = linkError(links.website);
  const linkedinError = linkError(links.linkedin, true);

  const checklist = [
    {
      done: Boolean(me.avatarUrl),
      label: "Ajouter un logo",
      target: "profil-identite",
    },
    {
      done: Boolean(me.bio?.trim()),
      label: "Rédiger une description",
      target: "profil-presentation",
    },
    {
      done: Boolean(me.sector),
      label: "Choisir un secteur",
      target: "profil-entreprise",
    },
    {
      done: Boolean(me.links?.website?.trim() && !linkError(me.links.website)),
      label: "Ajouter un site web",
      target: "profil-liens",
    },
    {
      done: ["website", "linkedin"].some((key) => {
        const value = me.links?.[key] || "";
        return value.trim() && !linkError(value, key === "linkedin");
      }),
      label: "Ajouter au moins un lien",
      target: "profil-liens",
    },
  ];
  const completion = Math.round(
    (checklist.filter((item) => item.done).length / checklist.length) * 100,
  );
  const missing = checklist.filter((item) => !item.done);
  const saveButtonDisabled = (section, invalidReason) =>
    saving[section] ? undefined : invalidReason || undefined;

  return (
    <section className="student-page">
      <PageHeader
        eyebrow="Mon compte"
        title="Mon profil"
        subtitle="Gérez les informations de votre compte entreprise."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          id="profil-identite"
          className={`${card} flex flex-col items-center p-6 text-center lg:sticky lg:top-[100px]`}
        >
          <div className="relative h-[120px] w-[120px] overflow-hidden rounded-[4px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]">
            {logo ? (
              <img
                src={logo}
                alt={`Logo de ${companyName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center font-['Source_Serif_4',Georgia,serif] text-[38px] font-semibold text-[var(--primary)]">
                {initials}
              </span>
            )}
            {logoBusy && (
              <span className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] text-[12px] font-semibold text-[var(--primary)]">
                Enregistrement…
              </span>
            )}
          </div>
          <input
            id={logoInputId}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="sr-only"
            aria-label="Choisir le logo de l’entreprise"
            tabIndex={-1}
            disabled={logoBusy}
            onChange={(event) => {
              changeLogo(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="mt-3 flex items-center gap-4">
            <ActionButton
              variant="secondary"
              loading={logoBusy}
              onClick={() => document.getElementById(logoInputId)?.click()}
            >
              <Camera size={14} aria-hidden="true" />
              {logoBusy ? "Enregistrement…" : "Changer le logo"}
            </ActionButton>
            {me.avatarUrl && (
              <ActionButton
                variant="danger"
                loading={logoBusy}
                onClick={removeLogo}
              >
                Supprimer
              </ActionButton>
            )}
          </div>
          <p className="m-0 mt-1 text-[11px] text-[var(--muted)]">
            JPG ou PNG, 2 Mo maximum
          </p>
          {logoError && (
            <p role="alert" className={fieldError}>
              {logoError}
            </p>
          )}

          <h2 className={`${sectionTitle} mt-5`}>{companyName}</h2>
          <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">Entreprise</p>
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
            id="profil-contact"
            title="Contact"
            dirty={dirty.contact}
            saving={saving.contact}
            error={errors.contact}
            onDismissError={() =>
              setErrors((current) => ({ ...current, contact: null }))
            }
            invalidReason={saveButtonDisabled(
              "contact",
              firstNameError || lastNameError || contactEmailError,
            )}
            onSave={() =>
              saveSection("contact", {
                firstName: contact.firstName.trim(),
                lastName: contact.lastName.trim(),
                contactEmail: contact.contactEmail.trim(),
              })
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Prénom"
                htmlFor="company-profile-first-name"
                error={firstNameError}
              >
                <input
                  id="company-profile-first-name"
                  className={`${input} ${disabledField}`}
                  value={contact.firstName}
                  autoComplete="given-name"
                  required
                  aria-invalid={firstNameError ? "true" : undefined}
                  aria-describedby={
                    firstNameError
                      ? "company-profile-first-name-error"
                      : undefined
                  }
                  disabled={saving.contact}
                  onChange={(event) =>
                    setField("contact", "firstName", event.target.value)
                  }
                />
              </Field>
              <Field
                label="Nom"
                htmlFor="company-profile-last-name"
                error={lastNameError}
              >
                <input
                  id="company-profile-last-name"
                  className={`${input} ${disabledField}`}
                  value={contact.lastName}
                  autoComplete="family-name"
                  required
                  aria-invalid={lastNameError ? "true" : undefined}
                  aria-describedby={
                    lastNameError
                      ? "company-profile-last-name-error"
                      : undefined
                  }
                  disabled={saving.contact}
                  onChange={(event) =>
                    setField("contact", "lastName", event.target.value)
                  }
                />
              </Field>
            </div>
            <Field
              label="E-mail de connexion"
              htmlFor="company-profile-login-email"
              hint="Utilisé pour vous connecter, non modifiable."
            >
              <div className="relative">
                <input
                  id="company-profile-login-email"
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
              label="E-mail de contact (facultatif)"
              htmlFor="company-profile-contact-email"
              error={contactEmailError}
            >
              <input
                id="company-profile-contact-email"
                type="email"
                className={`${input} ${disabledField}`}
                value={contact.contactEmail}
                autoComplete="email"
                aria-invalid={contactEmailError ? "true" : undefined}
                aria-describedby={
                  contactEmailError
                    ? "company-profile-contact-email-error"
                    : undefined
                }
                disabled={saving.contact}
                onChange={(event) =>
                  setField("contact", "contactEmail", event.target.value)
                }
              />
              {contact.contactEmail !== me.email && (
                <ActionButton
                  variant="secondary"
                  disabledReason={
                    saving.contact ? "Enregistrement en cours" : undefined
                  }
                  className={
                    saving.contact
                      ? "mt-2"
                      : "mt-2 min-h-0! border-0! bg-transparent! px-0! py-0! text-[12px]! font-semibold! text-[var(--primary)]! underline-offset-2 hover:underline"
                  }
                  onClick={() =>
                    setField("contact", "contactEmail", me.email || "")
                  }
                >
                  Utiliser l’e-mail de connexion
                </ActionButton>
              )}
            </Field>
          </Section>

          <Section
            id="profil-entreprise"
            title="Entreprise"
            dirty={dirty.company}
            saving={saving.company}
            error={errors.company}
            onDismissError={() =>
              setErrors((current) => ({ ...current, company: null }))
            }
            invalidReason={saveButtonDisabled("company", companyNameError)}
            onSave={() =>
              saveSection("company", {
                companyName: company.companyName.trim(),
                sector: company.sector,
                size: company.size,
                gouvernorat: company.gouvernorat,
              })
            }
          >
            <Field
              label="Nom de l’entreprise"
              htmlFor="company-profile-company-name"
              error={companyNameError}
            >
              <input
                id="company-profile-company-name"
                className={`${input} ${disabledField}`}
                value={company.companyName}
                autoComplete="organization"
                required
                aria-invalid={companyNameError ? "true" : undefined}
                aria-describedby={
                  companyNameError
                    ? "company-profile-company-name-error"
                    : undefined
                }
                disabled={saving.company}
                onChange={(event) =>
                  setField("company", "companyName", event.target.value)
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="company-profile-sector"
                label="Secteur"
                value={company.sector}
                options={SECTORS}
                disabled={saving.company}
                onChange={(value) => setField("company", "sector", value)}
              />
              <SelectField
                id="company-profile-size"
                label="Taille"
                value={company.size}
                options={COMPANY_SIZES}
                disabled={saving.company}
                onChange={(value) => setField("company", "size", value)}
              />
            </div>
            <SelectField
              id="company-profile-governorate"
              label="Gouvernorat"
              value={company.gouvernorat}
              options={GOVERNORATES}
              disabled={saving.company}
              onChange={(value) => setField("company", "gouvernorat", value)}
            />
          </Section>

          <Section
            id="profil-presentation"
            title="Présentation"
            dirty={dirty.presentation}
            saving={saving.presentation}
            error={errors.presentation}
            onDismissError={() =>
              setErrors((current) => ({ ...current, presentation: null }))
            }
            onSave={() =>
              saveSection("presentation", { bio: presentation.bio.trim() })
            }
          >
            <div>
              <label htmlFor="company-profile-description" className="sr-only">
                Présentation de l’entreprise
              </label>
              <textarea
                id="company-profile-description"
                value={presentation.bio}
                maxLength={800}
                disabled={saving.presentation}
                onChange={(event) =>
                  setField("presentation", "bio", event.target.value)
                }
                placeholder="Présentez brièvement votre entreprise."
                className={`block min-h-[130px] w-full resize-y rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[14px] leading-[1.6] text-[var(--text)] placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] aria-invalid:border-[var(--danger)] disabled:cursor-not-allowed disabled:bg-[var(--bg)] disabled:text-[var(--muted)] disabled:hover:border-[var(--border)] ${focusRing}`}
              />
              <p className="m-0 mt-1.5 text-right text-[12px] text-[var(--muted)]">
                {presentation.bio.length} / 800
              </p>
            </div>
          </Section>

          <Section
            id="profil-liens"
            title="Liens"
            description="Tous facultatifs."
            dirty={dirty.links}
            saving={saving.links}
            error={errors.links}
            onDismissError={() =>
              setErrors((current) => ({ ...current, links: null }))
            }
            invalidReason={saveButtonDisabled(
              "links",
              websiteError || linkedinError
                ? "Corrigez les adresses invalides."
                : "",
            )}
            onSave={() =>
              saveSection("links", {
                links: {
                  website: links.website.trim(),
                  linkedin: links.linkedin.trim(),
                },
              })
            }
          >
            {[
              {
                key: "website",
                label: "Site web",
                icon: Globe,
                placeholder: "https://votre-site.tn",
                error: websiteError,
              },
              {
                key: "linkedin",
                label: "LinkedIn",
                icon: BriefcaseBusiness,
                placeholder: "https://www.linkedin.com/company/votre-entreprise",
                error: linkedinError,
              },
            ].map((link) => {
              const Icon = link.icon;
              const value = links[link.key];
              const valid = value.trim() && !link.error;
              return (
                <Field
                  key={link.key}
                  label={link.label}
                  htmlFor={`company-profile-link-${link.key}`}
                  error={link.error}
                >
                  <div className="relative">
                    <Icon
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    />
                    <input
                      id={`company-profile-link-${link.key}`}
                      type="url"
                      inputMode="url"
                      className={`${input} ${disabledField} pl-10! pr-10`}
                      placeholder={link.placeholder}
                      value={value}
                      aria-invalid={link.error ? "true" : undefined}
                      aria-describedby={
                        link.error
                          ? `company-profile-link-${link.key}-error`
                          : undefined
                      }
                      disabled={saving.links}
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

      <p className="mb-0 mt-6 rounded-[4px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[13px] text-[var(--muted)]">
        Le nom de votre entreprise est visible par les étudiants sur vos offres.
      </p>
      {toast && <Toast message={toast} onClose={closeToast} />}
    </section>
  );
}
