const labels = {
  PENDING: "En attente",
  VIEWED: "Vue",
  IN_PROGRESS: "En cours",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  CONFIRMED: "Confirmée",
  DECLINED: "Déclinée",
  WITHDRAWN: "Retirée",
  SUBMITTED: "Soumise",
  SIGNED_STUDENT: "Signée par vous",
  SIGNED_COMPANY: "Signée par l’entreprise",
  APPROVED: "Approuvée",
  DRAFT: "Brouillon",
  REQUESTED: "Demandée",
  ASSIGNED: "Assignée",
  UNDER_REVIEW: "En cours de révision",
  CHANGES_REQUESTED: "Modifications demandées",
  VALIDATED: "Validé",
  OPEN: "Ouverte",
  CLOSED: "Fermée",
  FILLED: "Pourvue",
};
export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${String(status).toLowerCase()}`}>
      {labels[status] || status}
    </span>
  );
}
