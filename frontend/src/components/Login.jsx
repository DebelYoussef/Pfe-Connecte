import { Eye, EyeOff, LoaderCircle, MoveUpRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import ErrorBanner, { getErrorBanner } from "./ErrorBanner";
import { api } from '../api'
import { saveSession, homeFor } from '../auth'

const SHOW_FORGOT_PASSWORD = false;
const GOOGLE_ENABLED = false;
const EMAIL_RE = /\S+@\S+\.\S+/;
const FIELD_ORDER = ["email", "password"];

function fieldError(k, v) {
  if (k === "email") {
    if (!v) return "L’adresse e-mail est obligatoire.";
    if (!EMAIL_RE.test(v)) return "Saisissez une adresse e-mail valide.";
    return "";
  }
  return v ? "" : "Le mot de passe est obligatoire.";
}
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
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const values = { email, password };

  const clearField = (k) =>
    setErrors((p) => (p[k] ? { ...p, [k]: "" } : p));
  const blur = (k) =>
    setErrors((p) => ({ ...p, [k]: fieldError(k, values[k]) }));

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setBanner(null);
    const errs = {};
    FIELD_ORDER.forEach((k) => {
      const msg = fieldError(k, values[k]);
      if (msg) errs[k] = msg;
    });
    setErrors(errs);
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await api("/v1/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      saveSession({ token, user });
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setBanner(getErrorBanner(err, "login"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="brand-panel login-brand">
        <div className="panel-content">
          <Brand />
          <div className="welcome-copy">
            <p className="eyebrow">Votre avenir professionnel commence ici</p>
            <h1>Bon retour parmi nous</h1>
            <p>
              Suivez votre stage de fin d’études, de la candidature au rapport
              final.
            </p>
          </div>
          <div className="photo-message">
            <div className="photo-message-copy">
              <span className="photo-kicker">Votre parcours compte</span>
              <strong>Chaque étape vous rapproche de votre avenir.</strong>
              <span>Organisez votre stage avec confiance.</span>
            </div>
          </div>
          <p className="signup-prompt">
            Pas encore de compte ? <Link to="/signup">Créer un compte</Link>
            <Link
              className="arrow-link"
              to="/signup"
              aria-label="Créer un compte"
            >
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
        <div className="form-wrap">
          <div className="form-heading">
            <p className="eyebrow">Espace personnel</p>
            <h2>Connexion</h2>
            <p style={{ marginBottom: "2rem" }}>
              Pas de compte ? <Link to="/signup">Créer un compte</Link>
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
            <div className="field-group">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearField("email");
                  setBanner(null);
                }}
                onBlur={() => blur("email")}
                aria-invalid={errors.email ? "true" : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="field-error">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="field-group">
              <div className="password-label-row">
                <label htmlFor="password">Mot de passe</label>
                {SHOW_FORGOT_PASSWORD && (
                  <Link to="/forgot-password">Mot de passe oublié ?</Link>
                )}
              </div>
              <div className="password-input-wrap">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearField("password");
                    setBanner(null);
                  }}
                  onBlur={() => blur("password")}
                  aria-invalid={errors.password ? "true" : undefined}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={
                    show
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="field-error">
                  {errors.password}
                </p>
              )}
            </div>
            <button className="submit-button" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="spinner" size={18} />
                  Connexion en cours…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
            <div className="social-divider">
              <span>ou</span>
            </div>
            <button
              className="google-button"
              type="button"
              disabled={!GOOGLE_ENABLED}
              title={!GOOGLE_ENABLED ? "Bientôt disponible" : undefined}
            >
              <GoogleIcon />
              Continuer avec Google
            </button>
            {!GOOGLE_ENABLED && (
              <p className="disabled-note">
                TODO : l’authentification Google sera disponible prochainement.
              </p>
            )}
          </form>
        </div>
        <p className="form-footer">© 2026 PFE Connect</p>
      </section>
    </main>
  );
}