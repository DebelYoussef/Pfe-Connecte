import { Check } from "lucide-react";

const STEPS = ["Étudiant", "Entreprise", "Responsable", "Approuvée"];

export default function ConventionTracker({ doneSteps = [], waitingFor }) {
  return (
    <>
      <div className="convention-tracker" aria-label="Étapes de la convention">
        {STEPS.map((label, index) => (
          <div
            className={doneSteps[index] ? "tracker-step done" : "tracker-step"}
            key={label}
            aria-current={doneSteps[index] ? "step" : undefined}
          >
            <span>
              {doneSteps[index] ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                index + 1
              )}
            </span>
            <small>{label}</small>
          </div>
        ))}
      </div>
      {waitingFor && (
        <p className="convention-tracker-waiting">
          En attente de : {waitingFor}
        </p>
      )}
    </>
  );
}
