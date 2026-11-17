import { useEffect, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import { getMe, updateMe } from "../../services.responsable";

export default function ResponsableProfile() {
  const [me, setMe] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getMe();
      setMe(result);
      setFirstName(result.firstName || "");
      setLastName(result.lastName || "");
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
      const updated = await updateMe({ firstName: firstName.trim(), lastName: lastName.trim() });
      setMe(updated);
      setToast("Profil enregistré.");
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-page responsable-page">
      <PageHeader eyebrow="Espace responsable" title="Mon profil" subtitle="Informations du responsable de l’institution." />
      {error && <ErrorBanner title="Impossible de charger le profil" message={error.message} onRetry={() => void load()} />}
      {loading ? <Skeleton className="responsable-row-skeleton" /> : me && (
        <section className="responsable-detail-card responsable-profile-form">
          <label htmlFor="responsable-first-name">Prénom</label>
          <input id="responsable-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          <label htmlFor="responsable-last-name">Nom</label>
          <input id="responsable-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          <label htmlFor="responsable-email">Adresse e-mail</label>
          <input id="responsable-email" value={me.email || ""} disabled title="Adresse e-mail gérée par l’administration" />
          <label>Institution</label>
          <input value={me.etab === "ETAB2" ? "Institut B" : "Institut A"} disabled title="Institution liée au compte" />
          <button type="button" className="hero-button" disabled={saving || (!firstName.trim() || !lastName.trim())} onClick={() => void save()}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </section>
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
