import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Tooltip from "../../components/ui/Tooltip";
import SkillTagEditor, { normalizeSkill } from "../../pages/student/parts/SkillTagEditor";
import {
  COMPANY_GOUVERNORATS,
  COMPANY_WORK_MODES,
  createOffer,
  getOffer,
  updateOffer,
} from "../../services.company";

const EMPTY_FORM = {
  title: "",
  description: "",
  skills: [],
  keywords: [],
  gouvernorat: "",
  durationWeeks: "12",
  workMode: "ONSITE",
};

const WORK_MODE_LABELS = {
  ONSITE: "Sur site",
  HYBRID: "Hybride",
  REMOTE: "Télétravail",
};

function sameForm(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validate(form) {
  const errors = {};
  const title = form.title.trim();
  const description = form.description.trim();
  if (!title) errors.title = "Le titre est obligatoire.";
  else if (title.length > 200) errors.title = "Le titre ne peut pas dépasser 200 caractères.";
  if (!description) errors.description = "La description est obligatoire.";
  else if (description.length > 5000) errors.description = "La description ne peut pas dépasser 5 000 caractères.";
  if (!COMPANY_GOUVERNORATS.includes(form.gouvernorat))
    errors.gouvernorat = "Sélectionnez un gouvernorat.";
  if (!Number.isInteger(Number(form.durationWeeks)) || Number(form.durationWeeks) < 1)
    errors.durationWeeks = "La durée doit être un nombre entier d’au moins une semaine.";
  if (!COMPANY_WORK_MODES.includes(form.workMode))
    errors.workMode = "Sélectionnez un mode de travail.";
  if (form.skills.length > 10) errors.skills = "Dix compétences maximum.";
  if (form.keywords.length > 10) errors.keywords = "Dix mots-clés maximum.";
  return errors;
}

function Field({ id, label, error, children }) {
  return (
    <div className="company-offer-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <p className="company-offer-field-error" role="alert">{error}</p>}
    </div>
  );
}

export default function CompanyOfferForm() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(offerId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [baseForm, setBaseForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const dirty = !sameForm(form, baseForm);
  const errors = useMemo(() => validate(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const disabledReason = saving
    ? "Enregistrement en cours"
    : isEdit && !dirty
      ? "Aucune modification à enregistrer"
      : "";

  const loadOffer = useCallback(async () => {
    if (!isEdit) {
      setLoading(false);
      setLoadError(null);
      setForm(EMPTY_FORM);
      setBaseForm(EMPTY_FORM);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const offer = await getOffer(offerId);
      if (!["OPEN", "CLOSED"].includes(offer.status)) {
        throw {
          status: 409,
          code: "CONFLICT",
          message: "Une offre pourvue ne peut plus être modifiée.",
          details: {},
        };
      }
      const next = {
        title: offer.title || "",
        description: offer.description || "",
        skills: (offer.skills || []).map(normalizeSkill),
        keywords: (offer.keywords || []).map(normalizeSkill),
        gouvernorat: offer.gouvernorat || "",
        durationWeeks: String(offer.durationWeeks || 12),
        workMode: offer.workMode || "ONSITE",
      };
      setForm(next);
      setBaseForm(next);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [isEdit, offerId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadOffer();
    });
    return () => {
      active = false;
    };
  }, [loadOffer]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event?.preventDefault();
    setSubmitted(true);
    setSaveError(null);
    if (hasErrors || (isEdit && !dirty) || saving) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      skills: form.skills,
      keywords: form.keywords,
      gouvernorat: form.gouvernorat,
      durationWeeks: Number(form.durationWeeks),
      // NOT IN API YET: workMode is stored only by the company mock service.
      workMode: form.workMode,
    };
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await updateOffer(offerId, payload);
        navigate(`/company/offres/${updated.offerId}`, {
          replace: true,
          state: { toast: "Offre modifiée." },
        });
      } else {
        const created = await createOffer(payload);
        navigate(`/company/offres/${created.offerId}`, {
          replace: true,
          state: { toast: "Offre publiée." },
        });
      }
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  function requestBack() {
    if (dirty) setConfirmLeave(true);
    else navigate(isEdit ? `/company/offres/${offerId}` : "/company/offres");
  }

  if (loading) {
    return (
      <section className="company-offer-form-page" aria-busy="true">
        <PageHeader eyebrow="Espace entreprise" title={isEdit ? "Modifier une offre" : "Nouvelle offre"} />
        <Skeleton className="company-form-loading" />
        <Skeleton className="company-form-loading" />
        <Skeleton className="company-form-loading" />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="company-offer-form-page">
        <PageHeader eyebrow="Espace entreprise" title={isEdit ? "Modifier une offre" : "Nouvelle offre"} />
        <ErrorBanner
          title={loadError.status === 403 ? "Accès refusé" : loadError.status === 404 ? "Offre introuvable" : "Modification impossible"}
          message={loadError.message || "Veuillez réessayer."}
          onRetry={loadOffer}
        />
        <Link className="company-small-link" to="/company/offres">Retour à mes offres</Link>
      </section>
    );
  }

  return (
    <section className="company-offer-form-page">
      <button className="company-back-button" type="button" onClick={requestBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        {isEdit ? "Retour au détail" : "Retour à mes offres"}
      </button>
      <PageHeader
        eyebrow="Espace entreprise"
        title={isEdit ? "Modifier une offre" : "Nouvelle offre"}
        subtitle={isEdit ? "Mettez à jour les informations de votre offre." : "Présentez une opportunité de stage aux étudiants."}
      />

      {saveError && (
        <ErrorBanner
          title="Enregistrement impossible"
          message={saveError.message || "Veuillez réessayer."}
          onRetry={() => submit()}
        />
      )}

      <form className="company-offer-form" onSubmit={submit} noValidate>
        <Field id="offer-title" label="Titre de l’offre" error={submitted ? errors.title : ""}>
          <input
            id="offer-title"
            className="company-form-control"
            value={form.title}
            maxLength={200}
            aria-invalid={submitted && Boolean(errors.title)}
            onChange={(event) => setField("title", event.target.value)}
          />
          <span className="company-field-counter">{form.title.length} / 200</span>
        </Field>

        <Field id="offer-description" label="Description" error={submitted ? errors.description : ""}>
          <textarea
            id="offer-description"
            className="company-form-control company-form-textarea"
            value={form.description}
            maxLength={5000}
            rows={7}
            aria-invalid={submitted && Boolean(errors.description)}
            onChange={(event) => setField("description", event.target.value)}
          />
          <span className="company-field-counter">{form.description.length} / 5 000</span>
        </Field>

        <Field id="offer-skills" label="Compétences demandées" error={submitted ? errors.skills : ""}>
          <SkillTagEditor
            inputId="offer-skills"
            values={form.skills}
            onChange={(skills) => setField("skills", skills)}
            max={10}
            maxLabel="compétences"
            suggestions={["react", "python", "sql", "docker", "linux", "java"]}
          />
        </Field>

        <Field id="offer-keywords" label="Mots-clés" error={submitted ? errors.keywords : ""}>
          <SkillTagEditor
            inputId="offer-keywords"
            values={form.keywords}
            onChange={(keywords) => setField("keywords", keywords)}
            max={10}
            maxLabel="mots-clés"
            suggestions={["stage", "web", "data", "cloud", "sécurité"]}
          />
        </Field>

        <div className="company-form-two-columns">
          <Field id="offer-gouvernorat" label="Gouvernorat" error={submitted ? errors.gouvernorat : ""}>
            <select
              id="offer-gouvernorat"
              className="company-form-control"
              value={form.gouvernorat}
              aria-invalid={submitted && Boolean(errors.gouvernorat)}
              onChange={(event) => setField("gouvernorat", event.target.value)}
            >
              <option value="">Sélectionner un gouvernorat</option>
              {COMPANY_GOUVERNORATS.map((gouvernorat) => (
                <option key={gouvernorat} value={gouvernorat}>{gouvernorat}</option>
              ))}
            </select>
          </Field>

          <Field id="offer-duration" label="Durée du stage (semaines)" error={submitted ? errors.durationWeeks : ""}>
            <input
              id="offer-duration"
              className="company-form-control"
              type="number"
              min="1"
              step="1"
              value={form.durationWeeks}
              aria-invalid={submitted && Boolean(errors.durationWeeks)}
              onChange={(event) => setField("durationWeeks", event.target.value)}
            />
            <div className="company-duration-presets" aria-label="Durées suggérées">
              {[12, 16, 20, 24].map((weeks) => (
                <button
                  type="button"
                  className={Number(form.durationWeeks) === weeks ? "selected" : ""}
                  key={weeks}
                  onClick={() => setField("durationWeeks", String(weeks))}
                >
                  {weeks} semaines
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field id="offer-work-mode" label="Mode de travail" error={submitted ? errors.workMode : ""}>
          <select
            id="offer-work-mode"
            className="company-form-control"
            value={form.workMode}
            aria-invalid={submitted && Boolean(errors.workMode)}
            onChange={(event) => setField("workMode", event.target.value)}
          >
            {COMPANY_WORK_MODES.map((mode) => (
              <option value={mode} key={mode}>{WORK_MODE_LABELS[mode]}</option>
            ))}
          </select>
        </Field>

        <div className="company-offer-form-actions">
          <button className="company-secondary-button" type="button" onClick={requestBack}>
            Annuler
          </button>
          {disabledReason ? (
            <Tooltip content={disabledReason}>
              <span>
                <button className="company-primary-button company-button-disabled" type="submit" disabled>
                  {saving ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </span>
            </Tooltip>
          ) : (
            <button className="company-primary-button" type="submit">
              {isEdit ? "Enregistrer les modifications" : "Publier l’offre"}
            </button>
          )}
        </div>
      </form>

      {confirmLeave && (
        <ConfirmDialog
          open
          title="Quitter sans enregistrer ?"
          body="Vos modifications non enregistrées seront perdues."
          confirmLabel="Quitter"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => navigate(isEdit ? `/company/offres/${offerId}` : "/company/offres")}
        />
      )}
    </section>
  );
}
