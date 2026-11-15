import { Clock, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorBanner from '../../components/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import OfferActionButton from '../../components/ui/OfferActionButton'
import Tooltip from '../../components/ui/Tooltip'
import Toast from '../../components/ui/Toast'
import WorkModeBadge, { WORK_MODES } from '../../components/ui/WorkModeBadge'
import { applyToOffer, getMe, listMyApplications, listMyRecommendations, listOffers } from '../../services'

function OfferCard({ offer, application, activeCount, onApply, compatibility, profileSkills }) {
  const masteredSkills = new Set(profileSkills.map((skill) => skill.toLocaleLowerCase()))
  const skills = offer.skills ?? []

  return (
    <article className="offer-list-card">
      <div className="offer-card-head">
        <span className="offer-company">{offer.companyName}</span>
        {application?.status === 'CONFIRMED' ? (
          <StatusBadge status="CONFIRMED" />
        ) : offer.status !== 'OPEN' && offer.status !== 'CONFIRMED' ? (
          <StatusBadge status={offer.status} />
        ) : null}
      </div>
      <h2>{offer.title}</h2>
      <div className="offer-meta">
        <span><MapPin aria-hidden="true" size={14} />{offer.gouvernorat}</span>
        <span><Clock aria-hidden="true" size={14} />{offer.durationWeeks} semaines</span>
        <WorkModeBadge mode={offer.workMode} />
      </div>
      <div className="offer-skills">
        {skills.slice(0, 4).map((skill) => {
          const mastered = masteredSkills.has(skill.toLocaleLowerCase())
          const chip = <span tabIndex={mastered ? 0 : undefined} className={`skill-chip${mastered ? ' mastered' : ''}`}>{skill}</span>
          return mastered ? (
            <Tooltip key={skill} content="Vous maîtrisez cette compétence">{chip}</Tooltip>
          ) : (
            <span key={skill} className="skill-chip">{skill}</span>
          )
        })}
      </div>
      {compatibility != null && (
        <div className="compatibility">
          <span>Compatibilité {compatibility} %</span>
          <i><b style={{ width: `${compatibility}%` }} /></i>
        </div>
      )}
      <small className="offer-date">Publié le {new Date(offer.createdAt).toLocaleDateString('fr-FR')}</small>
      <div className="offer-actions">
        <Link to={`/student/offres/${offer.offerId}`}>Voir le détail</Link>
        <OfferActionButton
          offer={offer}
          application={application}
          activeCount={activeCount}
          onApply={() => onApply(offer)}
        />
      </div>
    </article>
  )
}

export default function Offers() {
  const [data, setData] = useState({ me: null, offers: [], apps: [], recommendations: [] })
  const [tab, setTab] = useState('recommended')
  const [query, setQuery] = useState('')
  const [gouvernorat, setGouvernorat] = useState('')
  const [duration, setDuration] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState(null)

  async function load() {
    try {
      const [me, all, apps, recs] = await Promise.all([
        getMe(),
        listOffers(),
        listMyApplications(),
        listMyRecommendations(),
      ])
      setData({ me, offers: all.items, apps: apps.items, recommendations: recs.items })
      setError(null)
    } catch (loadError) {
      setError(loadError)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    const source = tab === 'recommended' ? data.recommendations.map((item) => item.offer) : data.offers
    return source.filter((offer) => {
      const haystack = `${offer.title} ${offer.companyName} ${(offer.skills ?? []).join(' ')}`.toLowerCase()
      return (!query || haystack.includes(query.toLowerCase()))
        && (!gouvernorat || offer.gouvernorat === gouvernorat)
        && (!duration || String(offer.durationWeeks) === duration)
        && (!workMode || offer.workMode === workMode)
    })
  }, [data, tab, query, gouvernorat, duration, workMode])

  function apply(offer) {
    setDialog({ offer })
  }

  async function confirm() {
    try {
      await applyToOffer(dialog.offer.offerId)
      setToast('Candidature envoyée')
      setDialog(null)
      await load()
    } catch (submitError) {
      setError(submitError)
    }
  }

  if (error) {
    return <ErrorBanner title="Impossible de charger les offres" message={error.message || 'Réessayez dans un instant.'} onClose={() => setError(null)} />
  }
  if (!data.me) return <div className="dashboard-skeleton"><span /><span /><span /></div>

  const profileSkills = data.me.skills ?? []

  return (
    <section className="student-page">
      <PageHeader eyebrow="Opportunités" title="Offres de stage" subtitle="Découvrez les opportunités qui correspondent à votre profil." />
      <div className="active-applications-bar">
        <strong>Candidatures actives {data.me.activeCount}/5</strong>
        <i><b style={{ width: `${Math.min(100, data.me.activeCount / 5 * 100)}%` }} /></i>
      </div>
      <div className="offers-tabs">
        <button className={tab === 'recommended' ? 'active' : ''} onClick={() => setTab('recommended')}>Pour vous</button>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Toutes les offres</button>
      </div>
      <div className="offers-filters">
        <label>
          <Search aria-hidden="true" size={16} />
          <input aria-label="Rechercher une offre" placeholder="Rechercher une offre" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select aria-label="Gouvernorat" value={gouvernorat} onChange={(event) => setGouvernorat(event.target.value)}>
          <option value="">Gouvernorat</option>
          {['Tunis', 'Sousse', 'Sfax', 'Monastir', 'Nabeul', 'Gabès', 'Gafsa', 'Bizerte'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="Durée" value={duration} onChange={(event) => setDuration(event.target.value)}>
          <option value="">Durée</option>
          {[12, 16, 20, 24].map((item) => <option key={item} value={item}>{item} semaines</option>)}
        </select>
        <select aria-label="Mode de travail" value={workMode} onChange={(event) => setWorkMode(event.target.value)}>
          <option value="">Mode de travail</option>
          {WORK_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
        <button className="reset-filters" type="button" onClick={() => { setQuery(''); setGouvernorat(''); setDuration(''); setWorkMode('') }}>
          <SlidersHorizontal aria-hidden="true" size={15} />Réinitialiser
        </button>
      </div>
      {visible.length ? (
        <div className="offers-grid">
          {visible.map((offer) => (
            <OfferCard
              key={offer.offerId}
              offer={offer}
              application={data.apps.find((item) => String(item.offerId) === String(offer.offerId))}
              activeCount={data.me.activeCount}
              onApply={apply}
              profileSkills={profileSkills}
              compatibility={tab === 'recommended' ? data.recommendations.find((item) => String(item.offerId) === String(offer.offerId))?.score : null}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Aucune offre trouvée" message="Modifiez vos filtres pour voir d’autres opportunités." actionLabel="Réinitialiser" actionTo="/student/offres" />
      )}
      {dialog && (
        <ConfirmDialog
          open
          title={`Postuler à ${dialog.offer.title} ?`}
          body={`Il vous reste ${5 - data.me.activeCount} emplacement(s) de candidature active.`}
          confirmLabel="Confirmer"
          onCancel={() => setDialog(null)}
          onConfirm={confirm}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </section>
  )
}
