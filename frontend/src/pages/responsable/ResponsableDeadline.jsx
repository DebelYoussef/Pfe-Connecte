import { useEffect, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import {
  getDeadlineSettings,
  putDeadlineSettings,
} from "../../services.responsable";

function dateSummary(deadline) {
  if (!deadline) return "";
  const date = new Date(`${deadline}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const remaining = Math.ceil(
    (date.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (remaining < 0) return "Date dépassée";
  return `Il reste ${remaining} jour${remaining > 1 ? "s" : ""}`;
}

export default function ResponsableDeadline() {
  const [settings, setSettings] = useState(null);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");
  const [disableDialog, setDisableDialog] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getDeadlineSettings();
      setSettings(result);
      setBase(result);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const dirty = Boolean(
    settings &&
    base &&
    (
      settings.deadlineEnabled !== base.deadlineEnabled ||
      settings.deadline !== base.deadline
    ),
  );
  const valid =
    Boolean(settings) &&
    (!settings.deadlineEnabled || Boolean(settings.deadline));
  const remainingText = settings?.deadlineEnabled
    ? dateSummary(settings.deadline)
    : "";
  const remainingClass =
    settings?.deadline &&
    settings.deadlineEnabled &&
    (() => {
      const date = new Date(`${settings.deadline}T12:00:00`);
      const remaining = Math.ceil(
        (date.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      if (remaining < 14) return "danger";
      if (remaining < 30) return "amber";
      return "";
    })();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await putDeadlineSettings({
        deadlineEnabled: settings.deadlineEnabled,
        deadline: settings.deadline,
      });
      setSettings(updated);
      setBase(updated);
      setDisableDialog(false);
      setToast("Échéance enregistrée.");
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  function toggleEnabled() {
    if (settings.deadlineEnabled) {
      setDisableDialog(true);
      return;
    }
    setSettings((current) => ({ ...current, deadlineEnabled: true }));
  }

  return (
    <section className="student-page responsable-page">
      <PageHeader
        eyebrow="Espace responsable"
        title="Échéance du PFE"
        subtitle="Fixez la date limite des PFE de votre établissement. Les rappels automatiques s’appuient sur cette date."
      />
      {error && (
        <ErrorBanner
          title="Impossible d’enregistrer l’échéance"
          message={error.message || "Une erreur est survenue."}
          onRetry={() => void load()}
        />
      )}
      {loading ? (
        <Skeleton className="responsable-row-skeleton" />
      ) : settings ? (
        <section className="responsable-deadline-card-form">
          <div className="responsable-deadline-switch-row">
            <div>
              <h3>Activer l’échéance</h3>
              <small>Permettre aux étudiants de consulter la date limite.</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.deadlineEnabled}
              className={settings.deadlineEnabled ? "responsable-switch active" : "responsable-switch"}
              onClick={toggleEnabled}
            >
              <span />
            </button>
          </div>
          <label htmlFor="responsable-deadline">Date limite</label>
          <input
            id="responsable-deadline"
            type="date"
            value={settings.deadline || ""}
            disabled={!settings.deadlineEnabled}
            title={!settings.deadlineEnabled ? "Activez l’échéance pour définir une date" : "Date limite du PFE"}
            onChange={(event) =>
              setSettings((current) => ({ ...current, deadline: event.target.value }))
            }
          />
          {settings.deadlineEnabled && (
            <p className={`responsable-deadline-summary ${remainingClass}`}>
              {remainingText || "Choisissez une date limite"}
            </p>
          )}
          {!settings.deadlineEnabled && (
            <p className="responsable-deadline-summary">Échéance désactivée</p>
          )}
          <button
            type="button"
            className="hero-button responsable-deadline-save"
            disabled={!dirty || !valid || saving}
            title={
              !dirty
                ? "Aucune modification à enregistrer"
                : !valid
                  ? "Une date est requise lorsque l’échéance est active"
                  : "Enregistrer l’échéance"
            }
            onClick={() => void save()}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <p className="responsable-deadline-info">
            Les étudiants sans stage confirmé et les conventions bloquées vous sont signalés par notification.
          </p>
        </section>
      ) : null}
      {disableDialog && (
        <ConfirmDialog
          open
          title="Désactiver l’échéance ?"
          body="Les étudiants ne verront plus d’échéance."
          confirmLabel="Désactiver"
          onCancel={() => setDisableDialog(false)}
          onConfirm={() => {
            setSettings((current) => ({
              ...current,
              deadlineEnabled: false,
            }));
            setDisableDialog(false);
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
