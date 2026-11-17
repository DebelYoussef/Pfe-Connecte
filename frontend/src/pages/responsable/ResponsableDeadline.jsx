import { useEffect, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import { getDeadlineSettings, updateDeadlineSettings } from "../../services.responsable";

export default function ResponsableDeadline() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSettings(await getDeadlineSettings());
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
      const updated = await updateDeadlineSettings(settings);
      setSettings(updated);
      setToast("Échéance enregistrée.");
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-page responsable-page">
      <PageHeader eyebrow="Espace responsable" title="Échéance du PFE" subtitle="Définissez la date limite de dépôt pour votre institution." />
      {error && <ErrorBanner title="Impossible de charger l’échéance" message={error.message} onRetry={() => void load()} />}
      {loading ? <Skeleton className="responsable-row-skeleton" /> : settings && (
        <section className="responsable-detail-card responsable-deadline-form">
          <label>
            <input type="checkbox" checked={settings.deadlineEnabled} onChange={(event) => setSettings((current) => ({ ...current, deadlineEnabled: event.target.checked }))} />
            Activer l’échéance
          </label>
          <label htmlFor="responsable-deadline">Date limite</label>
          <input
            id="responsable-deadline"
            type="date"
            value={settings.deadline || ""}
            disabled={!settings.deadlineEnabled}
            title={!settings.deadlineEnabled ? "Activez l’échéance pour définir une date" : "Date limite"}
            onChange={(event) => setSettings((current) => ({ ...current, deadline: event.target.value }))}
          />
          <button type="button" className="hero-button" disabled={saving || (settings.deadlineEnabled && !settings.deadline)} onClick={() => void save()}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </section>
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
