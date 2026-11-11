import { Check, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "./ui/PageHeader";
export default function LockedPage({
  eyebrow,
  title,
  requirements = [],
  ctaLabel,
  ctaTo,
  preview,
}) {
  return (
    <section className="locked-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle="Cette étape sera disponible lorsque les conditions seront réunies."
      />
      <div className="locked-preview" aria-hidden="true">
        {preview || (
          <>
            <span />
            <span />
            <span />
            <span />
          </>
        )}
      </div>
      <div className="locked-card">
        <div className="locked-icon">
          <Lock size={20} />
        </div>
        <h2>Cette section n’est pas encore disponible</h2>
        <p>Avancez dans votre parcours pour débloquer cette fonctionnalité.</p>
        <ul>
          {requirements.map((item) => (
            <li key={item.label}>
              {item.done ? (
                <Check size={16} />
              ) : (
                <span className="empty-circle" />
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <Link className="hero-button" to={ctaTo}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
