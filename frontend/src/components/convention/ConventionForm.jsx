import { Lock, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { validateField } from "../../lib/conventionDocument";
import Tooltip from "../ui/Tooltip";

export default function ConventionForm({
  snapshot,
  values = {},
  source = "STUDENT",
  heading = "Mes informations",
  description = "Renseignez uniquement les champs réservés à votre partie.",
  editable = true,
  dirty = false,
  saving = false,
  fieldErrors = {},
  touched = {},
  submitted = false,
  onChange,
  onBlur,
  onSave,
  saveTooltip = "",
  saveDisabled = false,
  dirtyFieldCount = 0,
  showDirtyCount = dirty && !saveDisabled,
  profilePath,
  requestModification = false,
  onRequestModification,
  requestModificationLabel = "Demander une modification",
  lockedMessage = "Verrouillé : le document est signé. Toute modification annule les signatures.",
  periodErrorFieldKey,
  periodError,
  durationHint,
}) {
  const sections = snapshot?.sections || [];

  function isVisibleField(field) {
    if (field.source === source) return true;
    return (
      field.source === "AUTO" &&
      (source === "STUDENT" ||
        field.binding?.startsWith("company.") ||
        field.binding?.startsWith("offer."))
    );
  }

  function renderAutoField(field) {
    return (
      <div className="convention-auto-field" key={field.key}>
        <span className="convention-field-label">{field.label}</span>
        <div className="auto-field-value">
          <span>{values[field.key] || "—"}</span>
          <span className="auto-field-chip">
            Renseigné automatiquement
          </span>
        </div>
        {(field.helpText ||
          (field.binding === "offer.durationWeeks" && durationHint)) && (
          <small className="field-help">
            {field.helpText ||
              (field.binding === "offer.durationWeeks" && durationHint)}
          </small>
        )}
        {profilePath &&
          (source === "STUDENT" ||
            field.binding?.startsWith("company.")) && (
          <Link className="auto-field-profile-link" to={profilePath}>
            <UserRound aria-hidden="true" size={13} />
            Une information est incorrecte ?
          </Link>
        )}
      </div>
    );
  }

  return (
    <section className="info-card convention-student-info">
      <div className="convention-section-heading">
        <div>
          <h3>{heading}</h3>
          <p>{description}</p>
        </div>
        {!editable && (
          <Lock aria-label="Informations verrouillées" size={18} />
        )}
      </div>

      {!editable && (
        <div className="convention-locked-note">
          <Lock aria-hidden="true" size={15} />
          <span>{lockedMessage}</span>
        </div>
      )}
      {requestModification && (
        <button
          className="secondary-button request-modification"
          type="button"
          onClick={onRequestModification}
        >
          {requestModificationLabel}
        </button>
      )}

      <form className="convention-info-form" onSubmit={onSave} noValidate>
        {sections.map((section) => {
          const fields = (section.fields || []).filter(isVisibleField);
          if (!fields.length) return null;
          return (
            <fieldset
              className="student-field-group"
              key={section.id}
              disabled={false}
            >
              <legend>{section.title}</legend>
              <div className="student-fields-grid">
                {fields.map((field) =>
                  field.source === "AUTO" ? (
                    renderAutoField(field)
                  ) : (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={values[field.key] ?? ""}
                      disabled={!editable}
                      message={
                        fieldErrors[field.key] ||
                        validateField(field, values[field.key]) ||
                        (field.key === periodErrorFieldKey
                          ? periodError
                          : "")
                      }
                      touched={Boolean(touched[field.key] || submitted)}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  ),
                )}
              </div>
            </fieldset>
          );
        })}

        {editable && (
          <div className="convention-save-row">
            <Tooltip content={saveTooltip}>
              <span
                className="convention-disabled-action"
                tabIndex={saveDisabled ? 0 : undefined}
              >
                <button
                  className="submit-button"
                  type="submit"
                  disabled={saveDisabled}
                >
                  {saving
                    ? "Enregistrement…"
                    : "Enregistrer mes informations"}
                </button>
              </span>
            </Tooltip>
            {showDirtyCount && (
              <small>
                {dirtyFieldCount} champ
                {dirtyFieldCount > 1 ? "s" : ""} modifié
                {dirtyFieldCount > 1 ? "s" : ""}
              </small>
            )}
          </div>
        )}
      </form>

    </section>
  );
}

function FieldInput({
  field,
  value,
  disabled,
  message,
  touched,
  onChange,
  onBlur,
}) {
  const controlId = `convention-field-${field.key}`;
  const commonProps = {
    id: controlId,
    name: field.key,
    value: String(value ?? ""),
    required: field.required,
    placeholder: field.placeholder || "",
    "aria-invalid": Boolean(touched && message),
    "aria-describedby":
      [
        field.helpText ? `${controlId}-help` : "",
        touched && message ? `${controlId}-error` : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    onChange: (event) => onChange(field, event.target.value),
    onBlur: () => onBlur(field),
    disabled,
  };

  return (
    <label className="convention-field" htmlFor={controlId}>
      <span className="convention-field-label">
        {field.label}
        {field.required && <b aria-hidden="true"> *</b>}
        {field.sensitive && (
          <small className="sensitive-field-note">
            Facultatif · confidentiel
          </small>
        )}
      </span>
      {field.type === "textarea" ? (
        <textarea {...commonProps} rows={3} />
      ) : (
        <input
          {...commonProps}
          type={
            field.type === "phone"
              ? "tel"
              : ["date", "email", "number"].includes(field.type)
                ? field.type
                : "text"
          }
          inputMode={field.type === "phone" ? "tel" : undefined}
        />
      )}
      {field.helpText && (
        <small className="field-help" id={`${controlId}-help`}>
          {field.helpText}
        </small>
      )}
      {touched && message && (
        <small
          className="field-error"
          id={`${controlId}-error`}
          role="alert"
        >
          {message}
        </small>
      )}
    </label>
  );
}
