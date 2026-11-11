import { ArrowLeft, Clock, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import ErrorBanner from '../../components/ErrorBanner'
import OfferActionButton from '../../components/ui/OfferActionButton'
import Toast from '../../components/ui/Toast'
import Tooltip from '../../components/ui/Tooltip'
import WorkModeBadge from '../../components/ui/WorkModeBadge'
import { applyToOffer, getMe, getOffer, listMyApplications } from '../../services'

export default function OfferDetail() {
  const { offerId } = useParams()
  const [offer, setOffer] = useState(null)
  const [me, setMe] = useState(null)
  const [application, setApplication] = useState(null)
  const [dialog, setDialog] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getOffer(offerId), getMe(), listMyApplications()])
      .then(([nextOffer, nextMe, applications]) => {
        setOffer(nextOffer)
        setMe(nextMe)
        setApplication(applications.items.find((item) => String(item.offerId) === String(offerId)) ?? null)
        setError(null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [offerId])

  async function apply() {
    try {
      const nextApplication = await applyToOffer(offerId)
      setApplication(nextApplication)
      setMe((current) => current ? { ...current, activeCount: current.activeCount + 1 } : current)
      setToast('Candidature envoyée')
      setDialog(false)
    } catch (submitError) {
      setError(submitError)
    }
  }

  if (loading) return <div className="dashboard-skeleton"><span /><span /><span /></div>
  if (error) return <ErrorBanner title="Impossible de charger l’offre" message={error.message || 'Réessayez dans un instant.'} onClose={() => setError(null)} />
  if (!offer) return <div className="ui-empty-state"><h2>Offre introuvable</h2><p>Cette offre n’est plus disponible.</p><Link to="/student/offres">Retour aux offres</Link></div>

  const skills = offer.skills ?? []
  const profileSkills = new Set((me?.skills ?? []).map((skill) => skill.toLocaleLowerCase()))
  const masteredCount = skills.filter((skill) => profileSkills.has(skill.toLocaleLowerCase())).length
  const workModeLabel = offer.workMode === 'HYBRID' ? 'Hybride' : offer.workMode === 'REMOTE' ? 'Télétravail' : 'Sur site'

  return (
    <section className="student-page">
      <Link className="back-link" to="/student/offres"><ArrowLeft aria-hidden="true" size={15} />Retour aux offres</Link>
      <PageHeader eyebrow="Offres / détail" title={offer.title} subtitle={offer.companyName} />
      <div className="offer-detail-grid">
        <div>
          <div className="detail-meta">
            <span><MapPin aria-hidden="true" size={15} />{offer.gouvernorat}</span>
            <span><Clock aria-hidden="true" size={15} />{offer.durationWeeks} semaines</span>
            <WorkModeBadge mode={offer.workMode} />
            <StatusBadge status={offer.status} />
          </div>
          <section className="detail-section">
            <h2>Description</h2>
            <p>{offer.description}</p>
            <p>Vous rejoindrez une équipe qui accompagne les étudiants dans leur montée en compétences et leur projet de fin d’études.</p>
          </section>
          <section className="detail-section">
            <h2>Lieu et organisation</h2>
            <div className="detail-meta">
              <span><MapPin aria-hidden="true" size={15} />{offer.gouvernorat}</span>
              <WorkModeBadge mode={offer.workMode} />
            </div>
            {offer.workMode === 'HYBRID' && <p className="hybrid-note">Présence sur site partielle, à définir avec l&apos;entreprise.</p>}
          </section>
          <section className="detail-section">
            <h2>Compétences demandées</h2>
            <div className="offer-skills large">
              {skills.map((skill) => {
                const mastered = profileSkills.has(skill.toLocaleLowerCase())
                const chip = <span tabIndex={mastered ? 0 : undefined} className={`skill-chip${mastered ? ' mastered' : ''}`}>{skill}</span>
                return mastered ? <Tooltip key={skill} content="Vous maîtrisez cette compétence">{chip}</Tooltip> : <span key={skill} className="skill-chip">{skill}</span>
              })}
            </div>
            <p className="muted-copy">Vous maîtrisez {masteredCount} compétence{masteredCount === 1 ? '' : 's'} sur {skills.length}.</p>
          </section>
          <section className="detail-section">
            <h2>Mots-clés</h2>
            <div className="keyword-list">{(offer.keywords ?? []).map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
          </section>
        </div>
        <aside className="offer-detail-card">
          <span>Informations</span>
          <p className="offer-summary">{offer.durationWeeks} semaines · {workModeLabel}</p>
          <WorkModeBadge mode={offer.workMode} />
          <p className="offer-location">{offer.gouvernorat}</p>
          <p>Publié le {new Date(offer.createdAt).toLocaleDateString('fr-FR')}</p>
          <div className="slot-meter">
            <span>Candidatures actives {me?.activeCount ?? 0}/5</span>
            <i><b style={{ width: `${Math.min(100, (me?.activeCount ?? 0) / 5 * 100)}%` }} /></i>
          </div>
          <OfferActionButton offer={offer} application={application} activeCount={me?.activeCount ?? 0} onApply={() => setDialog(true)} />
        </aside>
      </div>
      {dialog && (
        <ConfirmDialog
          open
          title={`Postuler à ${offer.title} ?`}
          body={`Il vous reste ${5 - (me?.activeCount ?? 0)} emplacement(s) de candidature active.`}
          confirmLabel="Confirmer"
          onCancel={() => setDialog(false)}
          onConfirm={apply}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </section>
  )
}
