import { useEffect, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import { getConventionTemplate, updateConventionTemplate } from "../../services.responsable";

export default function ResponsableTemplate() {
  const [template, setTemplate] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getConventionTemplate();
      setTemplate(result);
      setText(result.text);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const updated = await updateConventionTemplate(text);
      setTemplate(updated);
      setToast("Modèle enregistré.");
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-page responsable-page">
      <PageHeader eyebrow="Espace responsable" title="Modèle de convention" subtitle="Personnalisez le texte utilisé par votre institution." />
      {error && <ErrorBanner title="Impossible de charger le modèle" message={error.message} onRetry={() => void load()} />}
      {loading ? <Skeleton className="responsable-detail-skeleton" /> : template && (
        <section className="responsable-detail-card">
          <div className="responsable-detail-heading">
            <h3>Version {template.version}</h3>
          </div>
          <p className="responsable-placeholder-help">Variables disponibles : {"{{etab}}"}, {"{{student}}"}, {"{{company}}"}, {"{{subject}}"}, {"{{startDate}}"}, {"{{endDate}}"}, {"{{durationWeeks}}"}</p>
          <textarea className="responsable-textarea responsable-template-text" value={text} onChange={(event) => setText(event.target.value)} />
          <button type="button" className="hero-button" disabled={saving || !text.trim()} onClick={() => void save()}>
            {saving ? "Enregistrement…" : "Enregistrer le modèle"}
          </button>
        </section>
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
