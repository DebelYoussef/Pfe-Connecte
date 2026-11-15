import { useEffect, useMemo, useState } from 'react'
import { Search, UserRound } from 'lucide-react'
import LockedPage from '../../components/LockedPage'
import PageHeader from '../../components/ui/PageHeader'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import ErrorBanner from '../../components/ErrorBanner'
import StatusBadge from '../../components/ui/StatusBadge'
import Toast from '../../components/ui/Toast'
import Tooltip from '../../components/ui/Tooltip'
import useInternshipStatus from '../../hooks/useInternshipStatus'
import { getUser } from '../../auth'
import { getMe, getMySupervision, listTeachers, requestSupervision } from '../../services'

function initialsFor(teacher) {
  return [teacher.firstName, teacher.lastName].filter(Boolean).map((name) => name[0]).join('').slice(0, 2).toUpperCase()
}

function getTeacherName(teacher) {
  return teacher.teacherName || [teacher.firstName, teacher.lastName].filter(Boolean).join(' ') || 'Enseignant'
}

export default function Supervisor() {
  const internship = useInternshipStatus()
  const [profile, setProfile] = useState(null)
  const [supervision, setSupervision] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [query, setQuery] = useState('')
  const [expertiseFilter, setExpertiseFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getMe(), getMySupervision()])
      .then(async ([me, nextSupervision]) => {
        if (!active) return
        const session = getUser() ?? {}
        const nextProfile = {
          ...me,
          ...session,
          firstName: session.firstName || me.firstName,
          lastName: session.lastName || me.lastName,
          email: session.email || me.email,
          etab: session.etab || session.institution || me.etab,
          department: session.department || me.department,
          specialty: session.specialty || me.specialty,
        }
        setProfile(nextProfile)
        setSupervision(nextSupervision)
        if (!nextSupervision || nextSupervision.status === 'DECLINED') {
          const directory = await listTeachers({ etab: nextProfile.etab })
          if (!active) return
          setTeachers(directory.items)
          setNextCursor(directory.nextCursor)
        }
      })
      .catch((loadError) => setError(loadError))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const directoryVisible = !supervision || supervision.status === 'DECLINED'
  const expertiseOptions = useMemo(() => [...new Set(teachers.flatMap((teacher) => teacher.expertise ?? []))].sort((a, b) => a.localeCompare(b, 'fr')), [teachers])
  const matchingTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return teachers.filter((teacher) => {
      const expertise = teacher.expertise ?? []
      const haystack = `${teacher.firstName} ${teacher.lastName} ${expertise.join(' ')}`.toLocaleLowerCase()
      return (!normalizedQuery || haystack.includes(normalizedQuery))
        && (!expertiseFilter || expertise.includes(expertiseFilter))
    })
  }, [teachers, query, expertiseFilter])

  async function loadMore() {
    if (!nextCursor || !profile?.etab || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await listTeachers({ etab: profile.etab, cursor: nextCursor })
      setTeachers((current) => [...current, ...result.items])
      setNextCursor(result.nextCursor)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoadingMore(false)
    }
  }

  async function request() {
    if (!selected) return
    setRequesting(true)
    try {
      const nextSupervision = await requestSupervision(selected.userId)
      setSupervision(nextSupervision)
      setSelected(null)
      setToast(`Demande envoyée à ${getTeacherName(nextSupervision)}.`)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setRequesting(false)
    }
  }

  if (internship.loading || loading) return <div className="dashboard-skeleton"><span /><span /><span /></div>
  if (internship.status !== 'approved') {
    return <LockedPage eyebrow="Suivi pédagogique" title="Mon encadrant" requirements={[{ label: 'Convention signée et approuvée', done: false }]} ctaLabel="Voir ma convention" ctaTo="/student/convention" preview={<div className="document-skeleton"><span /><span /><span /></div>} />
  }
  if (error && !profile) return <ErrorBanner title="Impossible de charger l’annuaire" message={error.message || 'Réessayez dans un instant.'} onClose={() => setError(null)} />

  const assigned = supervision?.status === 'ASSIGNED' || supervision?.status === 'ACCEPTED'
  const requested = supervision?.status === 'REQUESTED'
  const teacherName = supervision ? getTeacherName(supervision) : ''

  return (
    <section className="student-page">
      <PageHeader eyebrow="Suivi pédagogique" title="Mon encadrant" subtitle="Un enseignant vous accompagne pendant votre stage." />
      {error && <ErrorBanner title="Action impossible" message={error.message || 'Réessayez dans un instant.'} onClose={() => setError(null)} />}
      {supervision ? (
        <article className={`supervision-card${supervision.status === 'DECLINED' ? ' declined' : ''}`}>
          <div className="teacher-avatar">{initialsFor(supervision)}</div>
          <div className="supervision-card-content">
            <div className="supervision-card-heading">
              <h2>{requested ? `Demande envoyée à ${teacherName}` : supervision.status === 'DECLINED' ? `Demande déclinée par ${teacherName}` : teacherName}</h2>
              <StatusBadge status={supervision.status} />
            </div>
            <p><strong>Établissement</strong> {supervision.etab || '—'}</p>
            <div className="offer-skills supervisor-expertise">
              {(supervision.expertise ?? []).map((item) => <span key={item}>{item}</span>)}
            </div>
            {requested && <p className="muted-copy supervisor-note">Vous serez notifié de sa réponse.</p>}
            {assigned && <p className="muted-copy supervisor-note">Seul le responsable peut modifier cette affectation.</p>}
          </div>
        </article>
      ) : (
        <div className="supervision-empty">
          <UserRound aria-hidden="true" size={20} />
          <strong>Aucun encadrant pour le moment</strong>
          <p>Choisissez un enseignant de votre établissement.</p>
        </div>
      )}
      {directoryVisible && (
        <div className="teacher-directory">
          <div className="directory-head supervisor-directory-head">
            <div><h2>Annuaire des enseignants</h2><p>Enseignants de {profile?.etab || 'votre établissement'}.</p></div>
            <label>
              <Search aria-hidden="true" size={16} />
              <input aria-label="Rechercher par nom ou expertise" placeholder="Rechercher par nom ou expertise" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="expertise-filter-chips" aria-label="Filtrer par expertise">
            <button type="button" className={!expertiseFilter ? 'active' : ''} aria-pressed={!expertiseFilter} onClick={() => setExpertiseFilter('')}>Toutes</button>
            {expertiseOptions.map((expertise) => (
              <button type="button" className={expertiseFilter === expertise ? 'active' : ''} aria-pressed={expertiseFilter === expertise} key={expertise} onClick={() => setExpertiseFilter(expertise)}>{expertise}</button>
            ))}
          </div>
          {matchingTeachers.length ? (
            <div className="teachers-grid">
              {matchingTeachers.map((teacher) => (
                <article className="teacher-card" key={teacher.userId}>
                  <div className="teacher-avatar">{initialsFor(teacher)}</div>
                  <h3>{teacher.firstName} {teacher.lastName}</h3>
                  <p>{teacher.etab}</p>
                  <div className="offer-skills">{(teacher.expertise ?? []).map((item) => <span key={item}>{item}</span>)}</div>
                  <button className="hero-button" type="button" onClick={() => setSelected(teacher)}>Demander cet encadrant</button>
                </article>
              ))}
            </div>
          ) : <p className="directory-empty">Aucun enseignant ne correspond à votre recherche.</p>}
          {nextCursor && (
            <div className="load-more-wrap">
              {loadingMore ? (
                <Tooltip content="Chargement des enseignants…"><span className="load-more-tooltip" tabIndex={0}><button className="secondary-button" type="button" disabled>Chargement…</button></span></Tooltip>
              ) : <button className="secondary-button" type="button" onClick={loadMore}>Charger plus</button>}
            </div>
          )}
        </div>
      )}
      {directoryVisible && <p className="muted-copy">Le responsable peut aussi vous affecter un encadrant directement.</p>}
      {selected && (
        <ConfirmDialog
          open
          title={`Demander ${selected.firstName} ${selected.lastName} ?`}
          body="Votre demande sera envoyée à cet enseignant. Vous serez notifié de sa réponse."
          confirmLabel={requesting ? 'Envoi…' : 'Envoyer la demande'}
          confirmDisabled={requesting}
          onCancel={() => setSelected(null)}
          onConfirm={request}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </section>
  )
}
