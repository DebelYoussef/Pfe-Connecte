import { AlertCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function getErrorBanner(err, context) {
  const status = err?.status;
  if (err?.code === "NETWORK_ERROR") {
    return {
      title: "Serveur injoignable",
      message: "Vérifiez votre connexion internet puis réessayez.",
    };
  }
  if (status === 429) {
    return {
      title: "Trop de tentatives",
      message: "Patientez quelques instants avant de réessayer.",
    };
  }
  if (status >= 500) {
    return {
      title: "Erreur du serveur",
      message: "Une erreur est survenue. Réessayez dans un instant.",
    };
  }
  if (context === "login" && status === 401) {
    return {
      title: "Connexion impossible",
      message: "Adresse e-mail ou mot de passe incorrect.",
    };
  }
  if (context === "signup" && status === 409 && err.code === "EMAIL_TAKEN") {
    return {
      title: "Compte existant",
      message:
        "Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
    };
  }
  if (context === "signup" && status === 400) {
    return {
      title: "Informations invalides",
      message: err.message || "Vérifiez les champs du formulaire.",
    };
  }
  return {
    title: "Une erreur est survenue",
    message: err?.message || "Veuillez réessayer.",
  };
}

export default function ErrorBanner({ title, message, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [title, message]);

  return (
    <div
      ref={ref}
      className="error-banner"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="error-banner-icon" size={20} aria-hidden="true" />
      <div className="error-banner-body">
        <strong className="error-banner-title">{title}</strong>
        <p className="error-banner-message">{message}</p>
      </div>
      <button
        type="button"
        className="error-banner-close"
        onClick={onClose}
        aria-label="Fermer le message d’erreur"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}