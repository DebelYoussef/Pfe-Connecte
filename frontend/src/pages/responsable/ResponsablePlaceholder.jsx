import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";

export default function ResponsablePlaceholder() {
  return (
    <section className="student-page">
      <PageHeader eyebrow="Espace responsable" title="Section" />
      <EmptyState
        title="Cette section arrive bientôt."
        message="Cette fonctionnalité sera ajoutée prochainement."
        actionLabel="Retour à l’accueil"
        actionTo="/responsable"
      />
    </section>
  );
}
