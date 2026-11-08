import { Check, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const skills = [
  "python",
  "java",
  "aws",
  "docker",
  "react",
  "sql",
  "spring",
  "linux",
  "kubernetes",
  "django",
  "typescript",
  "git",
  "mongodb",
  "node",
  "angular",
];

function Brand() {
  return (
    <Link to="/login" className="brand-mark">
      <span className="brand-monogram">PC</span>
      <span>PFE Connect</span>
    </Link>
  );
}
function SelectField({ id, label, value, onChange, placeholder, options }) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
function Tags({ label, values, onChange, optional = false }) {
  const [text, setText] = useState("");
  function add(value) {
    const tag = value.trim().toLowerCase();
    if (tag && !values.includes(tag) && values.length < 10)
      onChange([...values, tag]);
    setText("");
  }
  return (
    <div className="field-group">
      <label>
        {label}
        {optional && <span className="optional-label"> (facultatif)</span>}
      </label>
      <div className="tag-input-wrap">
        {values.map((value) => (
          <span className="tag-chip" key={value}>
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Supprimer ${value}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === ",") && text.trim()) {
              event.preventDefault();
              add(text);
            }
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder="Écrire puis appuyer sur Entrée"
        />
      </div>
      {!optional && (
        <div className="tag-suggestions">
          <span>Suggestions :</span>
          {skills.slice(0, 6).map((skill) => (
            <button type="button" key={skill} onClick={() => add(skill)}>
              {skill}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompleteProfile() {
  const [role, setRole] = useState("Étudiant");
  const [etab, setEtab] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [gouvernorat, setGouvernorat] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [skillsValue, setSkillsValue] = useState([]);
  const [expertise, setExpertise] = useState([]);
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);
  }
  return (
    <main className="complete-profile-page">
      <section className="complete-profile-panel">
        <div className="complete-profile-topbar">
          <Brand />
          <ThemeToggle />
        </div>
        <div className="complete-profile-card">
          <div className="complete-profile-intro">
            <span className="complete-profile-step">Étape finale</span>
            <h1>Complétez votre profil</h1>
            <p>
              Votre compte Google est connecté. Ajoutez quelques informations
              pour personnaliser votre espace PFE Connect.
            </p>
          </div>
          <form onSubmit={submit}>
            <div className="profile-google-note">
              <span className="profile-avatar">G</span>
              <div>
                <strong>Compte Google connecté</strong>
                <span>Prêt à être configuré</span>
              </div>
              <Check size={18} />
            </div>
            <div className="field-group">
              <label>Votre profil</label>
              <div className="profile-role-options">
                {["Étudiant", "Entreprise", "Enseignant"].map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={
                      role === option
                        ? "profile-role-option active"
                        : "profile-role-option"
                    }
                    onClick={() => setRole(option)}
                    aria-pressed={role === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="profile-phone">
                Téléphone <span className="optional-label">(facultatif)</span>
              </label>
              <input
                id="profile-phone"
                type="tel"
                placeholder="+216 XX XXX XXX"
              />
            </div>
            {role === "Entreprise" ? (
              <div className="field-group">
                <label htmlFor="profile-company">Nom de l’entreprise</label>
                <input
                  id="profile-company"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Votre entreprise"
                  required
                />
              </div>
            ) : (
              <>
                <SelectField
                  id="profile-etab"
                  label="Établissement"
                  value={etab}
                  onChange={setEtab}
                  placeholder="Sélectionner votre établissement"
                  options={["Institut A", "Institut B"]}
                />
                {role === "Étudiant" ? (
                  <>
                    <div className="name-grid">
                      <SelectField
                        id="profile-department"
                        label="Département"
                        value={department}
                        onChange={setDepartment}
                        placeholder="Sélectionner votre département"
                        options={["Informatique", "Télécommunications"]}
                      />
                      <SelectField
                        id="profile-specialty"
                        label="Spécialité"
                        value={specialty}
                        onChange={setSpecialty}
                        placeholder="Sélectionner votre spécialité"
                        options={[
                          "Génie logiciel",
                          "Réseaux",
                          "Data science",
                          "Systèmes embarqués",
                        ]}
                      />
                    </div>
                    <SelectField
                      id="profile-gouvernorat"
                      label="Gouvernorat"
                      value={gouvernorat}
                      onChange={setGouvernorat}
                      placeholder="Sélectionner votre gouvernorat"
                      options={[
                        "Tunis",
                        "Sousse",
                        "Sfax",
                        "Monastir",
                        "Nabeul",
                        "Gabès",
                        "Gafsa",
                        "Bizerte",
                      ]}
                    />
                    <Tags
                      label="Compétences"
                      values={skillsValue}
                      onChange={setSkillsValue}
                    />
                  </>
                ) : (
                  <Tags
                    label="Domaines d’expertise"
                    values={expertise}
                    onChange={setExpertise}
                    optional
                  />
                )}
              </>
            )}
            <button className="submit-button" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="spinner" size={18} /> Enregistrement…
                </>
              ) : (
                "Terminer mon profil"
              )}
            </button>
          </form>
          <p className="complete-profile-note">
            Vous pourrez modifier ces informations depuis votre espace
            personnel.
          </p>
        </div>
      </section>
    </main>
  );
}
