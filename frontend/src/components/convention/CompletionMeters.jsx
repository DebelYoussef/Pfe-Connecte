import { AlertCircle } from "lucide-react";

export default function CompletionMeters({
  studentProgress,
  companyProgress,
  dirty = false,
}) {
  return (
    <section
      className="convention-completion info-card"
      aria-label="Complétude de la convention"
    >
      <div className="convention-section-heading">
        <div>
          <h3>Complétude</h3>
          <p>Suivez l’avancement des deux parties de la convention.</p>
        </div>
        {dirty && (
          <span className="unsaved-indicator">
            <AlertCircle aria-hidden="true" size={15} />
            Modifications non enregistrées
          </span>
        )}
      </div>
      <div className="completion-meters">
        <Meter label="Étudiant" progress={studentProgress} />
        <Meter label="Entreprise" progress={companyProgress} />
      </div>
    </section>
  );
}

function Meter({ label, progress }) {
  const ratio = progress.total
    ? Math.min(100, Math.round((progress.done / progress.total) * 100))
    : 0;
  return (
    <div className="completion-meter">
      <div className="completion-meter-heading">
        <strong>{label}</strong>
        <span>
          {progress.done} / {progress.total} champs
        </span>
      </div>
      <div
        className="completion-meter-track"
        role="progressbar"
        aria-label={`Complétude ${label.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <span style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}
