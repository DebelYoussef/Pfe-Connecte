function decisionLabel(decision) {
  if (decision === "APPROVED") return "Approuvé";
  if (decision === "CHANGES_REQUESTED") return "Modifications demandées";
  return "En attente";
}

export default function ReportDecisionRow({ label, decision, comment }) {
  return (
    <div className="teacher-detail-reviewer">
      <div>
        <strong>{label}</strong>
        <span
          className={
            decision
              ? "teacher-detail-decision"
              : "teacher-detail-decision pending"
          }
        >
          {decisionLabel(decision)}
        </span>
      </div>
      {comment && <p>{comment}</p>}
    </div>
  );
}
