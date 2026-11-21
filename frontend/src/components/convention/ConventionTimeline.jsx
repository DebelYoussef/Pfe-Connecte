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
  if (event.type === "FIELDS_UPDATED") {
    const party =
      event.actorRole === "ENT" ? "L’entreprise" : "L’étudiant";
    const count = event.count || 0;
    return `${party} a mis à jour sa partie (${count} champ${count === 1 ? "" : "s"})`;
  }
  if (event.type === "SIGNED") {
    return `Convention signée par ${ROLE_LABELS[event.actorRole] ?? event.actorRole}`;
  }
  if (event.type === "APPROVED") return "Convention approuvée";
  if (event.type === "CORRECTED") return "Convention corrigée par le responsable";
  if (event.type === "RESUBMITTED") return "Convention renvoyée pour signature";
  if (event.type === "REJECTED") {
    return `Convention refusée par ${ROLE_LABELS[event.actorRole] ?? event.actorRole}`;
  }
  if (event.type === "MODIFIED") {
    if (event.actorRole === "RESP") return "Convention corrigée par le responsable";
    if (event.actorRole === "ENT") return "Modification demandée par l’entreprise";
    return "Modification demandée par l’étudiant";
  }
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
            {event.type === "MODIFIED" && event.oldHash && (
              <small className="modified-hashes">
                Empreinte précédente{" "}
                <code>{event.oldHash.slice(0, 12)}</code>
                {event.newHash && (
                  <>
                    {" "}· nouvelle <code>{event.newHash.slice(0, 12)}</code>
                  </>
                )}
              </small>
            )}
            {event.type === "SIGNED" && event.hash && (
              <small className="modified-hashes">
                Empreinte signée <code>{event.hash.slice(0, 12)}</code>
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
