import { useState } from 'react'
import { Bell, Check, ChevronRight, Eye, EyeOff, LockKeyhole, Save, ShieldCheck, UserRound, X } from 'lucide-react'
import { teacher } from '../../data/teacherMockData'
import './teacherProfile.css'

const profileDefaults = {
  firstName: teacher.firstName,
  lastName: teacher.name.replace(teacher.firstName, '').trim(),
  email: teacher.email,
  phone: '+213 555 01 24 68',
  institution: 'École Nationale Supérieure',
  department: 'Informatique',
  specialties: 'Génie logiciel, Data & IA, Cybersécurité',
}

const preferenceDefaults = [
  { id: 'requests', label: 'Nouvelles demandes', description: 'Lorsqu’un étudiant demande un accompagnement.', enabled: true },
  { id: 'reports', label: 'Rapports soumis', description: 'Lorsqu’un étudiant dépose ou met à jour un rapport.', enabled: true },
  { id: 'reminders', label: 'Rappels', description: 'Pour les échéances et les soutenances à venir.', enabled: false },
]

function getInitials(firstName, lastName) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toLocaleUpperCase('fr')
}

export default function TeacherProfile() {
  const [profile, setProfile] = useState(profileDefaults)
  const [savedProfile, setSavedProfile] = useState(profileDefaults)
  const [preferences, setPreferences] = useState(preferenceDefaults)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const fullName = `${savedProfile.firstName} ${savedProfile.lastName}`.trim()

  function updateProfile(event) {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setMessage('')
  }

  function saveProfile(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!profile.firstName.trim()) nextErrors.firstName = 'Le prénom est obligatoire.'
    if (!profile.lastName.trim()) nextErrors.lastName = 'Le nom est obligatoire.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setMessage('')
      return
    }
    setSavedProfile({ ...profile, firstName: profile.firstName.trim(), lastName: profile.lastName.trim() })
    setMessage('Vos informations personnelles ont été enregistrées dans cette session.')
  }

  function cancelChanges() {
    setProfile(savedProfile)
    setErrors({})
    setMessage('Modifications annulées.')
  }

  function updatePreference(id) {
    setPreferences((current) => current.map((preference) => preference.id === id ? { ...preference, enabled: !preference.enabled } : preference))
  }

  function changePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    if (!password.current || !password.next || !password.confirm) {
      setPasswordError('Renseignez les trois champs pour valider votre saisie.')
      return
    }
    if (password.next.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password.next !== password.confirm) {
      setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.')
      return
    }
    setPasswordMessage('Les critères sont remplis. Aucun changement n’a été envoyé au serveur.')
    setPassword({ current: '', next: '', confirm: '' })
  }

  return <section className="pf-page" aria-labelledby="pf-title">
    <header className="pf-heading"><div><span className="pf-eyebrow">ESPACE ENSEIGNANT</span><h1 id="pf-title">Mon profil</h1><p>Gérez vos informations, vos préférences et les paramètres de votre compte enseignant.</p></div><span className="pf-role"><ShieldCheck size={17} />Enseignant encadrant</span></header>
    <section className="pf-identity" aria-label="Carte d’identité"><span className="pf-avatar">{getInitials(savedProfile.firstName, savedProfile.lastName)}</span><div className="pf-identity-info"><span className="pf-eyebrow">VOTRE COMPTE</span><h2>{fullName}</h2><p>{savedProfile.email}</p></div><span className="pf-identity-role"><UserRound size={15} />Enseignant encadrant</span></section>
    <div className="pf-layout"><div className="pf-main-column">
      <section className="pf-panel"><header className="pf-panel-heading"><span className="pf-panel-icon pf-panel-icon-teal"><UserRound size={18} /></span><div><h2>Informations personnelles</h2><p>Ces informations composent votre profil enseignant.</p></div></header>
        <form onSubmit={saveProfile} noValidate><div className="pf-form-grid">
          <label className="pf-field"><span>Prénom <i>*</i></span><input name="firstName" value={profile.firstName} onChange={updateProfile} autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? 'pf-first-error' : undefined} />{errors.firstName && <small id="pf-first-error" className="pf-field-error">{errors.firstName}</small>}</label>
          <label className="pf-field"><span>Nom <i>*</i></span><input name="lastName" value={profile.lastName} onChange={updateProfile} autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? 'pf-last-error' : undefined} />{errors.lastName && <small id="pf-last-error" className="pf-field-error">{errors.lastName}</small>}</label>
          <label className="pf-field"><span>E-mail</span><input name="email" type="email" value={profile.email} readOnly aria-readonly="true" /><small className="pf-field-hint">L’e-mail du compte ne peut pas être modifié ici.</small></label>
          <label className="pf-field"><span>Téléphone</span><input name="phone" type="tel" value={profile.phone} onChange={updateProfile} autoComplete="tel" /></label>
          <label className="pf-field"><span>Établissement</span><input name="institution" value={profile.institution} onChange={updateProfile} autoComplete="organization" /></label>
          <label className="pf-field"><span>Département</span><input name="department" value={profile.department} onChange={updateProfile} /></label>
          <label className="pf-field pf-field-wide"><span>Spécialités encadrées</span><textarea name="specialties" rows="3" value={profile.specialties} onChange={updateProfile} /></label>
        </div><div className="pf-form-footer"><span className="pf-required-note"><i>*</i> Champs obligatoires</span><div className="pf-form-actions"><button className="pf-button pf-button-quiet" type="button" onClick={cancelChanges}><X size={15} />Annuler</button><button className="pf-button pf-button-primary" type="submit"><Save size={15} />Enregistrer</button></div></div>{message && <p className={`pf-form-message ${Object.keys(errors).length ? 'pf-message-error' : ''}`} role="status">{message}</p>}</form>
      </section>
      <section className="pf-panel pf-preferences"><header className="pf-panel-heading"><span className="pf-panel-icon pf-panel-icon-gold"><Bell size={18} /></span><div><h2>Préférences de notification</h2><p>Choisissez les alertes que vous souhaitez recevoir.</p></div></header><div className="pf-preference-list">{preferences.map((preference) => <div className="pf-preference" key={preference.id}><span className="pf-preference-copy"><strong>{preference.label}</strong><small>{preference.description}</small></span><button className="pf-switch" type="button" role="switch" aria-checked={preference.enabled} aria-label={preference.label} onClick={() => updatePreference(preference.id)}><span /></button></div>)}</div></section>
    </div><aside className="pf-side-column"><section className="pf-panel pf-security"><header className="pf-panel-heading"><span className="pf-panel-icon pf-panel-icon-slate"><LockKeyhole size={18} /></span><div><h2>Sécurité</h2><p>Vérifiez les critères de votre nouveau mot de passe.</p></div></header><form onSubmit={changePassword} noValidate><label className="pf-field"><span>Mot de passe actuel</span><span className="pf-password-wrap"><input type={showCurrent ? 'text' : 'password'} value={password.current} onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))} autoComplete="current-password" /><button type="button" aria-label={showCurrent ? 'Masquer le mot de passe actuel' : 'Afficher le mot de passe actuel'} onClick={() => setShowCurrent((value) => !value)}>{showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label><label className="pf-field"><span>Nouveau mot de passe</span><span className="pf-password-wrap"><input type={showNext ? 'text' : 'password'} value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} autoComplete="new-password" /><button type="button" aria-label={showNext ? 'Masquer le nouveau mot de passe' : 'Afficher le nouveau mot de passe'} onClick={() => setShowNext((value) => !value)}>{showNext ? <EyeOff size={16} /> : <Eye size={16} />}</button></span><small className="pf-field-hint">8 caractères minimum.</small></label><label className="pf-field"><span>Confirmer le nouveau mot de passe</span><span className="pf-password-wrap"><input type={showConfirm ? 'text' : 'password'} value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} autoComplete="new-password" /><button type="button" aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'} onClick={() => setShowConfirm((value) => !value)}>{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>{passwordError && <p className="pf-password-feedback pf-password-error" role="alert">{passwordError}</p>}{passwordMessage && <p className="pf-password-feedback" role="status">{passwordMessage}</p>}<button className="pf-button pf-button-outline" type="submit"><LockKeyhole size={15} />Vérifier le nouveau mot de passe</button></form><div className="pf-security-note"><ShieldCheck size={15} /><span>Cette démonstration vérifie les champs localement, sans envoyer ni enregistrer de mot de passe.</span></div></section><div className="pf-help-note"><span className="pf-help-icon"><Check size={15} /></span><p>Votre profil est visible par les étudiants qui sollicitent un encadrement.</p><ChevronRight size={15} /></div></aside></div>
  </section>
}
