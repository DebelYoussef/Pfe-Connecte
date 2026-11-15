import { AlertCircle, RotateCw } from "lucide-react";
import { buttonVariants } from "./ui";

export default function RetryBanner({ title = "Chargement impossible", message, onRetry, retrying = false }) {
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] border-l-[3px] border-l-[var(--danger)] bg-[var(--danger-tint,color-mix(in_srgb,var(--danger)_8%,transparent))] px-4 py-3 text-[var(--danger)]"
    >
      <AlertCircle size={19} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong className="block text-[13px]">{title}</strong>
        <p className="m-0 text-[12px]">{message || "Une erreur est survenue. Vérifiez votre connexion puis réessayez."}</p>
      </div>
      <button type="button" className={buttonVariants.danger} onClick={onRetry} disabled={retrying}>
        <RotateCw size={15} className={retrying ? "animate-spin" : ""} aria-hidden="true" />
        Réessayer
      </button>
    </div>
  );
}
