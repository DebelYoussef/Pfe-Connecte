import {
  Building2,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  MoveUpRight,
  School,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import ErrorBanner, { getErrorBanner } from "./ErrorBanner";
import { api } from "../api";
import { saveSession, homeFor } from "../auth";

const GOOGLE_ENABLED = false;
const FIELD_ORDER = [
  "firstName",
  "lastName",
  "email",
  "password",
  "confirmPassword",
  "etab",
  "department",
  "specialty",
  "gouvernorat",
  "companyName",
  "accepted",
];
const skills = [
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
const roles = [
  ["ETU", "Étudiant", GraduationCap],
  ["ENT", "Entreprise", Building2],
  ["ENS", "Enseignant", School],
];
const ETABS = [
  { value: "ETAB1", label: "Institut A" },
  { value: "ETAB2", label: "Institut B" },
];
const DEPARTMENTS = [
  { value: "INFO", label: "Informatique" },
  { value: "TELECOM", label: "Télécommunications" },
];
function Brand() {
  return (
    <Link to="/login" className="brand-mark">
      <span className="brand-monogram">PC</span>
      <span>PFE Connect</span>
    </Link>
  );
}
const GoogleIcon = () => (
  <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M21.35 12.23c0-.74-.07-1.45-.21-2.13H12v4.03h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.29Z"
    />
    <path
      fill="#34A853"
      d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.6Z"
    />
    <path
      fill="#FBBC05"
      d="M6.54 13.68A5.85 5.85 0 0 1 6.23 12c0-.58.11-1.15.31-1.68V7.79H3.3A9.74 9.74 0 0 0 2.27 12c0 1.52.36 2.96 1.03 4.21l3.24-2.53Z"
    />
    <path
      fill="#EA4335"
      d="M12 6.29c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.37 14.63 2.4 12 2.4a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53c.77-2.31 2.92-4.03 5.46-4.03Z"
    />
  </svg>
);
function Select({ id, label, value, onChange, onBlur, options, error }) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">Sélectionner</option>
        {options.map((x) => {
          const o = typeof x === "string" ? { value: x, label: x } : x;
          return (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          );
        })}
      </select>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
function Tags({ label, values, onChange, optional }) {
  const [text, setText] = useState("");
  function add(v) {
    const t = v.trim().toLowerCase();
    if (t && !values.includes(t) && values.length < 10)
      onChange([...values, t]);
    setText("");
  }
  return (
    <div className="field-group">
      <label>
        {label}
        {optional && <span className="optional-label"> (facultatif)</span>}
      </label>
      <div className="tag-input-wrap">
        {values.map((v) => (
          <span className="tag-chip" key={v}>
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Supprimer ${v}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && text.trim()) {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder="Écrire puis appuyer sur Entrée"
        />
      </div>
      {!optional && (
        <div className="tag-suggestions">
          <span>Suggestions :</span>
          {skills.slice(0, 6).map((x) => (
            <button type="button" key={x} onClick={() => add(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export default function Signup() {
  const navigate = useNavigate();
  const [role, setRole] = useState("ETU");
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    etab: "",
    department: "",
    specialty: "",
    gouvernorat: "",
    companyName: "",
    skills: [],
    expertise: [],
  });
  const [accepted, setAccepted] = useState(false);
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [emailTaken, setEmailTaken] = useState(false);
  const [banner, setBanner] = useState(null);

  const clearField = (k) =>
    setErrors((p) => (p[k] ? { ...p, [k]: "" } : p));
  const set = (k, v) => {
    setF((x) => ({ ...x, [k]: v }));
    clearField(k);
    if (k === "email") setEmailTaken(false);
    setBanner(null);
  };
  const strength = useMemo(
    () =>
      f.password
        ? Math.min(
            4,
            (f.password.length >= 8 ? 1 : 0) +
              (/[A-Z]/.test(f.password) ? 1 : 0) +
              (/\d/.test(f.password) ? 1 : 0) +
              (/[^A-Za-z0-9]/.test(f.password) ? 1 : 0),
          )
        : 0,
    [f.password],
  );
  const validate = () => {
    const e = {};
    if (!f.firstName) e.firstName = "Le prénom est obligatoire.";
    if (!f.lastName) e.lastName = "Le nom est obligatoire.";
    if (!f.email) e.email = "L’adresse e-mail est obligatoire.";
    else if (!/\S+@\S+\.\S+/.test(f.email))
      e.email = "Saisissez une adresse e-mail valide.";
    if (f.password.length < 8) e.password = "Minimum 8 caractères.";
    if (f.confirmPassword !== f.password)
      e.confirmPassword = "Les mots de passe ne correspondent pas.";
    if (role === "ETU") {
      if (!f.etab) e.etab = "L’établissement est obligatoire.";
      if (!f.department) e.department = "Le département est obligatoire.";
      if (!f.specialty) e.specialty = "La spécialité est obligatoire.";
      if (!f.gouvernorat) e.gouvernorat = "Le gouvernorat est obligatoire.";
    }
    if (role === "ENT" && !f.companyName)
      e.companyName = "Le nom est obligatoire.";
    if (role === "ENS" && !f.etab) e.etab = "L’établissement est obligatoire.";
    if (!accepted) e.accepted = "Vous devez accepter les conditions.";
    return e;
  };
  const blur = (k) => {
    if (k === "email" && emailTaken) return;
    const msg = validate()[k] || "";
    setErrors((p) => ({ ...p, [k]: msg }));
  };
  const focusId = (k) =>
    k === "etab" && role === "ENS" ? "teacher-etab" : k;
  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setBanner(null);
    setEmailTaken(false);
    const errs = validate();
    setErrors(errs);
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) {
      document.getElementById(focusId(first))?.focus();
      return;
    }
    setLoading(true);
    try {
      const email = f.email.trim();
      const payload =
        role === "ETU"
          ? {
              role,
              email,
              password: f.password,
              firstName: f.firstName,
              lastName: f.lastName,
              etab: f.etab,
              department: f.department,
              specialty: f.specialty,
              gouvernorat: f.gouvernorat,
              skills: f.skills,
            }
          : role === "ENT"
            ? {
                role,
                email,
                password: f.password,
                firstName: f.firstName,
                lastName: f.lastName,
                companyName: f.companyName,
              }
            : {
                role,
                email,
                password: f.password,
                firstName: f.firstName,
                lastName: f.lastName,
                etab: f.etab,
                expertise: f.expertise,
              };
      const { token, user } = await api("/v1/auth/signup", {
        method: "POST",
        body: payload,
      });
      saveSession({ token, user });
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      if (err.status === 409 && err.code === "EMAIL_TAKEN") {
        setEmailTaken(true);
        setErrors((p) => ({
          ...p,
          email: "Cette adresse e-mail est déjà utilisée.",
        }));
        document.getElementById("email")?.focus();
      }
      setBanner(getErrorBanner(err, "signup"));
    } finally {
      setLoading(false);
    }
  }
  function field(k, label, type = "text") {
    const err = errors[k];
    return (
      <div className="field-group">
        <label htmlFor={k}>{label}</label>
        <input
          id={k}
          type={type}
          value={f[k]}
          onChange={(e) => set(k, e.target.value)}
          onBlur={() => blur(k)}
          aria-invalid={err ? "true" : undefined}
          aria-describedby={err ? `${k}-error` : undefined}
        />
        {err && (
          <p id={`${k}-error`} className="field-error">
            {err}
          </p>
        )}
      </div>
    );
  }
  return (
    <main className="auth-page signup-page">
      <section className="brand-panel">
        <div className="panel-content">
          <Brand />
          <div className="welcome-copy">
            <p className="eyebrow">Construisez votre avenir</p>
            <h1>Rejoignez PFE Connect</h1>
            <p>Un seul espace pour votre stage de fin d’études.</p>
          </div>
          <div className="signup-steps">
            <div className="signup-step">
              <span>1</span>
              <p>Postulez aux offres</p>
            </div>
            <div className="signup-step">
              <span>2</span>
              <p>Signez votre convention en ligne</p>
            </div>
            <div className="signup-step">
              <span>3</span>
              <p>Suivez votre stage et déposez votre rapport</p>
            </div>
          </div>
          <p className="signup-prompt">
            Déjà un compte ? <Link to="/login">Se connecter</Link>
            <Link className="arrow-link" to="/login" aria-label="Se connecter">
              <MoveUpRight size={17} />
            </Link>
          </p>
        </div>
      </section>
      <section className="form-panel">
        <div className="form-topbar">
          <div className="compact-brand">
            <Brand />
          </div>
          <ThemeToggle />
        </div>
        <div className="signup-form-wrap">
          <div className="form-heading">
            <p className="eyebrow">Créez votre espace</p>
            <h2>Créer un compte</h2>
            <p>
              Déjà inscrit ? <Link to="/login">Se connecter</Link>
            </p>
          </div>
          {banner && (
            <ErrorBanner
              title={banner.title}
              message={banner.message}
              onClose={() => setBanner(null)}
            />
          )}
          <form onSubmit={submit} noValidate>
            <fieldset className="role-selector">
              <legend className="sr-only">Choisissez votre profil</legend>
              {roles.map(([v, label, Icon]) => (
                <button
                  type="button"
                  key={v}
                  className={`role-card ${role === v ? "selected" : ""}`}
                  onClick={() => {
                    setRole(v);
                    setBanner(null);
                  }}
                  aria-pressed={role === v}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {role === v && <Check className="role-check" size={14} />}
                </button>
              ))}
            </fieldset>
            <div className="name-grid">
              {field("firstName", "Prénom")}
              {field("lastName", "Nom")}
            </div>
            {field("email", "Adresse e-mail", "email")}
            <div className="field-group">
              <label htmlFor="password">Mot de passe</label>
              <div className="password-input-wrap">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  value={f.password}
                  onChange={(e) => set("password", e.target.value)}
                  onBlur={() => blur("password")}
                  aria-invalid={errors.password ? "true" : undefined}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="strength-bar">
                {[1, 2, 3, 4].map((x) => (
                  <span
                    key={x}
                    className={
                      x <= strength ? `filled strength-${strength}` : ""
                    }
                  />
                ))}
              </div>
              {errors.password && (
                <p id="password-error" className="field-error">
                  {errors.password}
                </p>
              )}
            </div>
            <div className="field-group">
              <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
              <div className="password-input-wrap">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={f.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  onBlur={() => blur("confirmPassword")}
                  aria-invalid={errors.confirmPassword ? "true" : undefined}
                  aria-describedby={
                    errors.confirmPassword ? "confirmPassword-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="confirmPassword-error" className="field-error">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
            {role === "ETU" && (
              <>
                <Select
                  id="etab"
                  label="Établissement"
                  value={f.etab}
                  onChange={(v) => set("etab", v)}
                  onBlur={() => blur("etab")}
                  options={ETABS}
                  error={errors.etab}
                />
                <div className="name-grid">
                  <Select
                    id="department"
                    label="Département"
                    value={f.department}
                    onChange={(v) => set("department", v)}
                    onBlur={() => blur("department")}
                    options={DEPARTMENTS}
                    error={errors.department}
                  />
                  <Select
                    id="specialty"
                    label="Spécialité"
                    value={f.specialty}
                    onChange={(v) => set("specialty", v)}
                    onBlur={() => blur("specialty")}
                    options={[
                      "Génie logiciel",
                      "Réseaux",
                      "Data science",
                      "Systèmes embarqués",
                    ]}
                    error={errors.specialty}
                  />
                </div>
                <Select
                  id="gouvernorat"
                  label="Gouvernorat"
                  value={f.gouvernorat}
                  onChange={(v) => set("gouvernorat", v)}
                  onBlur={() => blur("gouvernorat")}
                  options={[
                    "Tunis",
                    "Sousse",
                    "Sfax",
                    "Monastir",
                    "Nabeul",
                    "Gabès",
                    "Gafsa",
                    "Bizerte",
                  ]}
                  error={errors.gouvernorat}
                />
                <Tags
                  label="Compétences"
                  values={f.skills}
                  onChange={(v) => set("skills", v)}
                />
              </>
            )}
            {role === "ENT" && field("companyName", "Nom de l’entreprise")}
            {role === "ENS" && (
              <>
                <Select
                  id="teacher-etab"
                  label="Établissement"
                  value={f.etab}
                  onChange={(v) => set("etab", v)}
                  onBlur={() => blur("etab")}
                  options={ETABS}
                  error={errors.etab}
                />
                <Tags
                  label="Domaines d’expertise"
                  values={f.expertise}
                  onChange={(v) => set("expertise", v)}
                  optional
                />
              </>
            )}
            <label className="terms-row">
              <input
                id="accepted"
                type="checkbox"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  clearField("accepted");
                  setBanner(null);
                }}
                onBlur={() => blur("accepted")}
                aria-invalid={errors.accepted ? "true" : undefined}
                aria-describedby={errors.accepted ? "accepted-error" : undefined}
              />{" "}
              <span>
                J’accepte les <Link to="/terms">conditions d’utilisation</Link>
              </span>
            </label>
            {errors.accepted && (
              <p id="accepted-error" className="field-error">
                {errors.accepted}
              </p>
            )}
            <button className="submit-button" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="spinner" size={18} />
                  Création en cours…
                </>
              ) : (
                "Créer mon compte"
              )}
            </button>
            <div className="social-divider">
              <span>ou</span>
            </div>
            <button
              className="google-button"
              type="button"
              disabled={!GOOGLE_ENABLED}
              title="Bientôt disponible"
              onClick={() =>
                GOOGLE_ENABLED && navigate("/signup/complete-profile")
              }
            >
              <GoogleIcon />
              Continuer avec Google
            </button>
            <p className="disabled-note">
              TODO : l’authentification Google sera disponible prochainement.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}