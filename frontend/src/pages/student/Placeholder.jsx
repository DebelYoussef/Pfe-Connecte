import { Link, useLocation } from "react-router-dom";
export default function Placeholder() {
  const location = useLocation();
  return (
    <section className="placeholder-page">
      <p className="eyebrow">Espace étudiant</p>
      <h1>Bientôt disponible</h1>
      <p>
        Cette section sera disponible prochainement dans votre espace PFE
        Connect.
      </p>
      <Link className="hero-button" to="/student">
        Retour à l’accueil
      </Link>
      <small>Page : {location.pathname}</small>
    </section>
  );
}
