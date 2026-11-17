import { Copy, QrCode, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

export default function VerificationCard({ convention, onCopy }) {
  const approvedEvent = [...(convention.events || [])]
    .reverse()
    .find((event) => event.type === "APPROVED");
  const approvedAt = convention.approvedAt || approvedEvent?.timestamp;

  return (
    <div className="info-card verify-card">
      <h3>Vérification</h3>
      {convention.state === "APPROVED" ? (
        <>
          <div className="qr-placeholder" aria-label="Code QR de vérification">
            <QrCode aria-hidden="true" size={30} />
          </div>
          <div className="verification-reference">
            <code>{convention.shortRef}</code>
            <button
              type="button"
              aria-label="Copier la référence de vérification"
              onClick={() => onCopy(convention.shortRef, "Référence")}
            >
              <Copy aria-hidden="true" size={14} />
            </button>
          </div>
          <p>Approuvée le {formatDate(approvedAt)}</p>
          <Link to={`/verify/${convention.conventionId}`}>
            Ouvrir la page de vérification
          </Link>
        </>
      ) : (
        <p className="verification-invalid">
          <XCircle aria-hidden="true" size={16} />
          Non valide : la convention n’est pas encore approuvée
        </p>
      )}
    </div>
  );
}
