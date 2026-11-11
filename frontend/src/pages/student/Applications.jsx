import { MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import ErrorBanner from '../../components/ErrorBanner'
import Toast from '../../components/ui/Toast'
import WorkModeBadge from '../../components/ui/WorkModeBadge'
import { actOnApplication, listMyApplications, listOffers } from '../../services'

const progressSteps = [
  { status: 'PENDING', label: 'Envoyée' },
  { status: 'VIEWED', label: 'Vue' },
  { status: 'IN_PROGRESS', label: 'En cours' },
  { status: 'ACCEPTED', label: 'Acceptée' },
  { status: 'CONFIRMED', label: 'Confirmée' },
]
const activeStatuses = new Set(['PENDING', 'VIEWED', 'IN_PROGRESS', 'ACCEPTED'])
const completedStatuses = new Set(['REJECTED', 'DECLINED', 'WITHDRAWN', 'CONFIRMED'])
const progressForStatus = { PENDING: 0, VIEWED: 1, IN_PROGRESS: 2, ACCEPTED: 3, CONFIRMED: 4, REJECTED: 0, DECLINED: 3, WITHDRAWN: 0 }

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR')
}

export default function Applications() {
  const [apps, setApps] = useState([])
  const [tab, setTab] = useState('all')
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const [applicationData, offerData] = await Promise.all([listMyApplications(), listOffers()])
      const offersById = new Map(offerData.items.map((offer) => [String(offer.offerId), offer]))
      setApps(applicationData.items.map((application) => {
        const offer = offersById.get(String(application.offerId))
        return {
          ...application,
          gouvernorat: application.gouvernorat ?? offer?.gouvernorat,
          workMode: application.workMode ?? offer?.workMode,
        }
      }))
      setError(null)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const allApps = apps
  const activeApps = useMemo(() => allApps.filter((app) => activeStatuses.has(app.status)), [allApps])
  const completedApps = useMemo(() => allApps.filter((app) => completedStatuses.has(app.status)), [allApps])
  const visible = tab === 'active' ? activeApps : tab === 'done' ? completedApps : allApps

  async function action() {
    try {
      await actOnApplication(dialog.app.offerId, dialog.action)
      setDialog(null)
      setToast(dialog.action === 'confirm' ? 'Stage confirmé.' : dialog.action === 'decline' ? 'Offre déclinée.' : 'Candidature retirée.')
      await load()
    } catch (actionError) {
      setError(actionError)
    }
  }

  if (error) return <ErrorBanner title="Impossible de charger vos candidatures" message={error.message || 'Réessayez dans un instant.'} onClose={() => setError(null)} />
  if (loading) return <div className="dashboard-skeleton"><span /><span /><span /></div>

  const activeCount = activeApps.length
  const emptyContent = tab === 'active'
    ? { title: 'Aucune candidature active', message: 'Vos candidatures en cours apparaîtront ici.' }
    : tab === 'done'
      ? { title: 'Aucune candidature terminée', message: 'Les candidatures refusées, déclinées, retirées ou confirmées apparaîtront ici.' }
      : { title: 'Aucune candidature', message: 'Trouvez une offre qui correspond à votre projet.' }

  return (
    <section className="student-page">
      <PageHeader eyebrow="Suivi" title="Mes candidatures" subtitle="Suivez chaque étape de vos candidatures." />
      <div className="active-applications-bar">
        <strong>{activeCount}/5 candidatures actives</strong>
        <i><b style={{ width: `${Math.min(100, activeCount / 5 * 100)}%` }} /></i>
      </div>
      <div className="applications-tabs" role="tablist" aria-label="Filtrer les candidatures">
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Toutes ({allApps.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Actives ({activeApps.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>Terminées ({completedApps.length})</button>
      </div>
      {visible.length ? (
        <div className="applications-list" role="tabpanel">
          {visible.map((app) => {
            const progressIndex = progressForStatus[app.status] ?? -1
            return (
              <article className={app.status === 'ACCEPTED' ? 'application-card accepted' : 'application-card'} key={app.offerId}>
                <div className="application-head">
                  <div><h2>{app.offerTitle}</h2><p>{app.companyName}</p></div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="application-meta">
                  <WorkModeBadge mode={app.workMode} />
                  <span><MapPin aria-hidden="true" size={14} />{app.gouvernorat ?? 'Lieu à préciser'}</span>
                </div>
                <div className="application-dates">
                  <span><strong>Postulé le</strong> {formatDate(app.createdAt)}</span>
                  <span><strong>Dernière mise à jour</strong> {formatDate(app.updatedAt ?? app.createdAt)}</span>
                </div>
                <div className="application-progress" role="img" aria-label={`Progression : ${app.status}`}>
                  {progressSteps.map((step, index) => (
                    <span className={progressIndex >= index ? 'reached' : ''} key={step.status} aria-current={app.status === step.status ? 'step' : undefined}>
                      {step.label}
                    </span>
                  ))}
                </div>
                {app.status === 'ACCEPTED' && (
                  <div className="accepted-banner">
                    <span>L’entreprise vous a accepté</span>
                    <button type="button" onClick={() => setDialog({ app, action: 'confirm' })}>Confirmer mon stage</button>
                    <button type="button" onClick={() => setDialog({ app, action: 'decline' })}>Décliner</button>
                  </div>
                )}
                {activeStatuses.has(app.status) && app.status !== 'ACCEPTED' && (
                  <button type="button" className="withdraw-button" onClick={() => setDialog({ app, action: 'withdraw' })}>Retirer</button>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div role="tabpanel">
          <EmptyState
            title={emptyContent.title}
            message={emptyContent.message}
            actionLabel={tab === 'all' ? 'Voir les offres' : undefined}
            actionTo={tab === 'all' ? '/student/offres' : undefined}
          />
        </div>
      )}
      {dialog && (
        <ConfirmDialog
          key={`${dialog.app.offerId}-${dialog.action}`}
          open
          title={dialog.action === 'confirm' ? 'Confirmer mon stage ?' : dialog.action === 'decline' ? 'Décliner cette offre ?' : 'Retirer cette candidature ?'}
          body={dialog.action === 'confirm'
            ? `La confirmation crée votre convention de stage. Cette action est définitive.`
            : dialog.action === 'decline'
              ? 'Décliner cette offre est définitif et libère une place parmi vos candidatures actives.'
              : 'Cette action libère une place parmi vos 5 candidatures actives.'}
          acknowledgementLabel={dialog.action === 'confirm'
            ? 'Je confirme que je souhaite accepter cette offre et créer ma convention de stage.'
            : dialog.action === 'decline'
              ? 'Je comprends que mon refus est définitif.'
              : undefined}
          confirmLabel={dialog.action === 'confirm' ? 'Confirmer définitivement' : dialog.action === 'decline' ? 'Décliner définitivement' : 'Retirer'}
          onCancel={() => setDialog(null)}
          onConfirm={action}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </section>
  )
}
