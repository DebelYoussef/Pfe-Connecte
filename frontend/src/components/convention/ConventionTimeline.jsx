const ROLE_LABELS = {
  ETU: "l’étudiant",
  ENT: "l’entreprise",
  RESP: "le responsable",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function getEventTitle(event) {
  if (event.type === "SUBMITTED") return "Convention transmise";
  if (event.type === "SIGNED") {
    return `Convention signée par ${ROLE_LABELS[event.actorRole] ?? event.actorRole}`;
  }
  if (event.type === "APPROVED") return "Convention approuvée";
  if (event.type === "REJECTED") {
    return `Convention refusée par ${ROLE_LABELS[event.actorRole] ?? event.actorRole}`;
  }
  if (event.type === "MODIFIED") return "Informations modifiées par l’étudiant";
  return event.message || "Événement de convention";
}

export default function ConventionTimeline({
  events = [],
  showRejectionReason = false,
  invalidatedLabel = "Signature annulée après modification",
}) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (!sortedEvents.length) {
    return <p className="timeline-empty">Aucun événement enregistré pour le moment.</p>;
  }

  return (
    <div className="convention-timeline">
      {sortedEvents.map((event, index) => (
        <div
          className={`timeline-event${event.invalidated ? " invalidated" : ""}`}
          key={`${event.timestamp}-${index}`}
        >
          <span />
          <div>
            <strong>{getEventTitle(event)}</strong>
            {event.type === "MODIFIED" && (
              <small className="modified-hashes">
                Empreinte précédente <code>{event.oldHash}</code> · nouvelle{" "}
                <code>{event.newHash}</code>
              </small>
            )}
            {event.invalidated && (
              <small>{invalidatedLabel}</small>
            )}
            {showRejectionReason && event.type === "REJECTED" && event.reason && (
              <small>Motif : {event.reason}</small>
            )}
            <small>{formatDate(event.timestamp)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
