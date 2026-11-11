import { Link } from "react-router-dom";
export default function EmptyState({
  title = "Rien à afficher pour le moment",
  message,
  actionLabel,
  actionTo,
}) {
  return (
    <div className="ui-empty-state">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {actionLabel && actionTo && (
        <Link className="hero-button" to={actionTo}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
