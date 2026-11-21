import { Download, Lock, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner'
import PageHeader from '../../components/ui/PageHeader'
import LockedPage from '../../components/LockedPage'
import StatusBadge from '../../components/ui/StatusBadge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toast from '../../components/ui/Toast'
import Tooltip from '../../components/ui/Tooltip'
import ConventionDocument from '../../components/convention/ConventionDocument'
import ConventionTracker from '../../components/convention/ConventionTracker'
import ConventionTimeline from '../../components/convention/ConventionTimeline'
import VerificationCard from '../../components/convention/VerificationCard'
import { getUser } from '../../auth'
import { etabName } from '../../lib/conventionDocument'
import { getConventionPdfUrl, getMe, getMyConvention, saveConventionStudentInfo, signConvention } from '../../services'

const trackerSteps = [
  { label: 'Étudiant', actorRole: 'ETU' },
  { label: 'Entreprise', actorRole: 'ENT' },
  { label: 'Responsable', actorRole: 'RESP' },
  { label: 'Approuvée', actorRole: null },
]
const phonePattern = /^\+216 \d{2} \d{3} \d{3}$/
const roleLabels = { ETU: 'l’étudiant', ENT: 'l’entreprise', RESP: 'le responsable' }

function formatDate(value, options = { dateStyle: 'medium' }) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', options).format(date)
}

function getSignatureEvents(convention) {
  const events = convention.events ?? []
  const lastModificationIndex = events.map((event) => event.type).lastIndexOf('MODIFIED')
  return events.slice(lastModificationIndex + 1).filter((event) => !event.invalidated)
}

function getStudentTurnMessage(convention, signatureEvents) {
  if (convention.state === 'APPROVED') return 'La convention est déjà approuvée.'
  if (convention.state === 'DRAFT') return 'En attente du renvoi par le responsable.'
  if (signatureEvents.some((event) => event.type === 'SIGNED' && event.actorRole === 'ETU')) return 'En attente de la signature de l’entreprise.'
  if (signatureEvents.some((event) => event.type === 'SIGNED' && event.actorRole === 'ENT')) return 'En attente de la signature du responsable.'
  if (signatureEvents.some((event) => event.type === 'SIGNED' && event.actorRole === 'RESP')) return 'En attente de l’approbation du responsable.'
  if (convention.currentActorId === convention.studentId) return 'C’est au tour de l’étudiant.'
  if (convention.currentActorId === convention.companyId) return 'C’est au tour de l’entreprise.'
  const role = String(convention.currentActorId ?? '').split('#')[0]
  return roleLabels[role] ? `C’est au tour de ${roleLabels[role]}.` : 'La signature n’est pas disponible à cette étape.'
}

function getProfileValue(profile, session, key) {
  return session[key] || profile[key] || '—'
}

export default function Convention() {
  const [convention, setConvention] = useState(null)
  const [profile, setProfile] = useState(null)
  const [draft, setDraft] = useState({ studentAddress: '', studentPhone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [modificationDialogOpen, setModificationDialogOpen] = useState(false)
  const [editingAfterSignature, setEditingAfterSignature] = useState(false)
  const [signatureAcknowledged, setSignatureAcknowledged] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getMyConvention(), getMe()])
      .then(([nextConvention, nextProfile]) => {
        if (!active) return
        const session = getUser() ?? {}
        const mergedProfile = {
          ...nextProfile,
          ...session,
          firstName: session.firstName || nextProfile.firstName,
          lastName: session.lastName || nextProfile.lastName,
          email: session.email || nextProfile.email,
          etab: session.etab || nextProfile.etab,
          department: session.department || nextProfile.department,
          specialty: session.specialty || nextProfile.specialty,
        }
        setConvention(nextConvention)
        setProfile(mergedProfile)
        setDraft({
          studentAddress: nextConvention?.studentAddress ?? '',
          studentPhone: nextConvention?.studentPhone ?? '',
        })
      })
      .catch((loadError) => setError(loadError.message || 'Impossible de charger la convention.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const signatureEvents = useMemo(() => convention ? getSignatureEvents(convention) : [], [convention])
  const hasSignature = convention?.state === 'APPROVED' || signatureEvents.some((event) => event.type === 'SIGNED')
  const editableWithoutSignature = convention?.state === 'DRAFT'
    || (convention?.state === 'SUBMITTED' && !hasSignature)
  const informationEditable = Boolean(editableWithoutSignature || (hasSignature && editingAfterSignature))
  const canSign = convention?.state === 'SUBMITTED'
    && !signatureEvents.some((event) => event.type === 'SIGNED' && event.actorRole === 'ETU')
  const studentName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.name || '—'
  const validation = useMemo(() => ({
    studentAddress: draft.studentAddress.trim() ? '' : 'L’adresse est requise.',
    studentPhone: !draft.studentPhone.trim()
      ? 'Le téléphone est requis.'
      : phonePattern.test(draft.studentPhone.trim())
        ? ''
        : 'Format attendu : +216 22 345 678.',
  }), [draft])

  function updateField(field, value) {
    const next = { ...draft, [field]: value }
    setDraft(next)
    setTouched((current) => ({ ...current, [field]: true }))
    setFieldErrors((current) => ({ ...current, [field]: field === 'studentAddress'
      ? next.studentAddress.trim() ? '' : 'L’adresse est requise.'
      : !next.studentPhone.trim() ? 'Le téléphone est requis.' : phonePattern.test(next.studentPhone.trim()) ? '' : 'Format attendu : +216 22 345 678.' }))
  }

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value)
      setToast(`${label} copié`)
    } catch {
      setToast('Impossible de copier dans le presse-papiers.')
    }
  }

  async function saveInformation(event) {
    event.preventDefault()
    setSubmitted(true)
    setTouched({ studentAddress: true, studentPhone: true })
    setFieldErrors(validation)
    if (Object.values(validation).some(Boolean)) return

    setSaving(true)
    setError('')
    try {
      const result = await saveConventionStudentInfo(draft, { allowAfterSignature: editingAfterSignature })
      setConvention(result.convention)
      setDraft({ studentAddress: result.convention.studentAddress, studentPhone: result.convention.studentPhone })
      setEditingAfterSignature(false)
      setSubmitted(false)
      setTouched({})
      setFieldErrors({})
      setToast(!result.changed
        ? 'Aucune modification détectée'
        : result.signaturesReset
          ? 'Convention modifiée : les signatures ont été annulées.'
          : 'Informations enregistrées et document régénéré.')
    } catch (saveError) {
      setError(saveError.message || 'Impossible d’enregistrer les informations.')
    } finally {
      setSaving(false)
    }
  }

  async function sign() {
    try {
      const updated = await signConvention(convention.conventionId)
      setConvention(updated)
      setSignDialogOpen(false)
      setSignatureAcknowledged(false)
      setToast('Convention signée électroniquement.')
    } catch (signError) {
      setError(signError.message || 'Impossible de signer la convention.')
    }
  }

  async function download() {
    try {
      const result = await getConventionPdfUrl(convention.conventionId)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (downloadError) {
      setError(downloadError.message || 'Impossible de préparer le téléchargement.')
    }
  }

  if (loading) return <div className="dashboard-skeleton"><span /><span /><span /></div>
  if (!convention) return <LockedPage eyebrow="Document officiel" title="Ma convention de stage" requirements={[{ label: 'Confirmer un stage accepté', done: false }]} ctaLabel="Voir mes candidatures" ctaTo="/student/candidatures" preview={<div className="document-skeleton"><span /><span /><span /><span /></div>} />

  const events = [...(convention.events ?? [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const trackerDone = trackerSteps.map((step, index) => convention.state === 'APPROVED'
    || (index < 3 && signatureEvents.some((event) => event.type === 'SIGNED' && event.actorRole === step.actorRole)))
  const canRequestModification = hasSignature && convention.state !== 'DRAFT' && !editingAfterSignature
  const turnMessage = getStudentTurnMessage(convention, signatureEvents)

  return (
    <section className="student-page convention-page">
      <PageHeader eyebrow="Document officiel" title="Ma convention de stage" subtitle="Le document officiel de votre parcours." action={<StatusBadge status={convention.state} />} />
      {convention.state === 'DRAFT' && events.some((event) => event.type === 'MODIFIED' && !event.invalidated) ? (
        <div className="convention-modified-banner" role="alert">
          <XCircle aria-hidden="true" size={18} />
          <span>Convention modifiée : les signatures ont été annulées. En attente de renvoi par le responsable.</span>
        </div>
      ) : convention.state === 'DRAFT' && convention.rejectionReason ? (
        <div className="convention-rejected" role="alert"><strong>Convention refusée</strong><span>{convention.rejectionReason}</span><small>Le responsable corrige le texte, vous serez notifié lorsqu’elle sera renvoyée.</small></div>
      ) : null}
      {error && (
        <ErrorBanner
          title="Impossible de charger ou d’enregistrer la convention"
          message={error}
          onRetry={() => window.location.reload()}
        />
      )}
      <ConventionTracker doneSteps={trackerDone} />
      <div className="convention-grid">
        <div className="convention-main-column">
          <section className="info-card convention-student-info">
            <div className="convention-section-heading">
              <div><h3>Mes informations</h3><p>Complétez la partie étudiant de votre convention.</p></div>
              {hasSignature && !informationEditable && <Lock aria-label="Informations verrouillées" size={18} />}
            </div>
            {hasSignature && !informationEditable && (
              <div className="convention-locked-note"><Lock aria-hidden="true" size={15} /><span>Verrouillé : une signature est déjà enregistrée.</span></div>
            )}
            {canRequestModification && (
              <button className="secondary-button request-modification" type="button" onClick={() => setModificationDialogOpen(true)}>Demander une modification</button>
            )}
            <form className="convention-info-form" onSubmit={saveInformation} noValidate>
              <label className="convention-field">
                <span>Adresse <b aria-hidden="true">*</b></span>
                <textarea required rows={3} value={draft.studentAddress} readOnly={!informationEditable} aria-invalid={Boolean((touched.studentAddress || submitted) && (fieldErrors.studentAddress || validation.studentAddress))} onChange={(event) => updateField('studentAddress', event.target.value)} />
                {(touched.studentAddress || submitted) && (fieldErrors.studentAddress || validation.studentAddress) && <small className="field-error" role="alert">{fieldErrors.studentAddress || validation.studentAddress}</small>}
              </label>
              <label className="convention-field">
                <span>Téléphone <b aria-hidden="true">*</b></span>
                <input required type="tel" inputMode="tel" placeholder="+216 22 345 678" value={draft.studentPhone} readOnly={!informationEditable} aria-invalid={Boolean((touched.studentPhone || submitted) && (fieldErrors.studentPhone || validation.studentPhone))} onChange={(event) => updateField('studentPhone', event.target.value)} />
                {(touched.studentPhone || submitted) && (fieldErrors.studentPhone || validation.studentPhone) && <small className="field-error" role="alert">{fieldErrors.studentPhone || validation.studentPhone}</small>}
              </label>
              <div className="convention-session-details">
                <strong>Informations du compte</strong>
                <dl>
                  <div><dt>Nom</dt><dd>{studentName}</dd></div>
                  <div><dt>E-mail</dt><dd>{getProfileValue(profile ?? {}, getUser() ?? {}, 'email')}</dd></div>
                  <div><dt>Établissement</dt><dd>{etabName(getProfileValue(profile ?? {}, getUser() ?? {}, 'etab'))}</dd></div>
                  <div><dt>Département</dt><dd>{getProfileValue(profile ?? {}, getUser() ?? {}, 'department')}</dd></div>
                  <div><dt>Spécialité</dt><dd>{getProfileValue(profile ?? {}, getUser() ?? {}, 'specialty')}</dd></div>
                </dl>
              </div>
              {informationEditable && <button className="submit-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer mes informations'}</button>}
            </form>
          </section>
          <ConventionDocument
            convention={convention}
            highlightParty="STUDENT"
          />
          <div className="document-actions convention-action-bar">
            {canSign ? (
              <button className="submit-button" type="button" onClick={() => setSignDialogOpen(true)}>Signer la convention</button>
            ) : (
              <Tooltip content={turnMessage}>
                <span className="convention-disabled-action" tabIndex={0}>
                  <button className="submit-button" type="button" disabled>Signer la convention</button>
                </span>
              </Tooltip>
            )}
            <button className="secondary-button" type="button" onClick={download}><Download aria-hidden="true" size={15} />Télécharger le PDF</button>
          </div>
        </div>
        <aside className="convention-aside">
          <div className="info-card">
            <h3>Informations</h3>
            <p><strong>Entreprise</strong>{convention.companyName}</p>
            <p><strong>Offre</strong>{convention.offerTitle}</p>
            <p><strong>Établissement</strong>{convention.etabName || etabName(convention.etab)}</p>
            <p><strong>Créée le</strong>{formatDate(convention.createdAt)}</p>
          </div>
          <div className="info-card convention-history">
            <h3>Historique</h3>
            <ConventionTimeline events={events} />
          </div>
          <VerificationCard convention={convention} onCopy={copyValue} />
        </aside>
      </div>
      {signDialogOpen && (
        <ConfirmDialog
          open
          title="Signer la convention"
          body={<div className="sign-checkbox"><label><input type="checkbox" checked={signatureAcknowledged} onChange={(event) => setSignatureAcknowledged(event.target.checked)} />J’ai lu la convention et je la signe électroniquement.</label><small>Empreinte du document : <code>{convention.pdfSha256?.slice(0, 12)}</code></small></div>}
          confirmLabel="Signer électroniquement"
          onCancel={() => { setSignDialogOpen(false); setSignatureAcknowledged(false) }}
          confirmDisabled={!signatureAcknowledged}
          onConfirm={sign}
        />
      )}
      {modificationDialogOpen && (
        <ConfirmDialog
          open
          title="Demander une modification ?"
          body="Modifier vos informations annule toutes les signatures. La convention repasse en brouillon et doit être signée à nouveau par l'entreprise et le responsable."
          acknowledgementLabel="Je comprends"
          confirmLabel="Continuer la modification"
          onCancel={() => setModificationDialogOpen(false)}
          onConfirm={() => { setEditingAfterSignature(true); setModificationDialogOpen(false) }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </section>
  )
}
