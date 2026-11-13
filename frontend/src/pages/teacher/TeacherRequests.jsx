import { useMemo, useState } from 'react'
import { Check, Clock3, GraduationCap, Search, UserRound, X } from 'lucide-react'
import { requests as initialRequests } from '../../data/teacherMockData'
import './teacherRequests.css'

const labels = { REQUESTED: 'En attente', ACCEPTED: 'Acceptée', DECLINED: 'Refusée' }
const options = ['Tous les statuts', ...Object.values(labels)]

function RequestStatus({ status }) {
  return <span className={`rq-badge rq-badge-${status.toLowerCase()}`}><i />{labels[status]}</span>
}

export default function TeacherRequests() {
  const [items, setItems] = useState(initialRequests)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(options[0])
  const filtered = useMemo(() => items.filter((item) => {
    const term = query.trim().toLocaleLowerCase('fr')
    return `${item.name} ${item.subject} ${item.institution}`.toLocaleLowerCase('fr').includes(term) && (filter === options[0] || labels[item.status] === filter)
  }), [items, query, filter])
  const counts = [
    { label: 'Total des demandes', count: items.length, icon: GraduationCap, type: 'teal' },
    { label: 'En attente', count: items.filter((item) => item.status === 'REQUESTED').length, icon: Clock3, type: 'gold' },
    { label: 'Acceptées', count: items.filter((item) => item.status === 'ACCEPTED').length, icon: Check, type: 'green' },
    { label: 'Refusées', count: items.filter((item) => item.status === 'DECLINED').length, icon: X, type: 'rose' },
  ]
  const updateStatus = (id, status) => setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))

  return <section className="rq-page" aria-labelledby="rq-title">
    <header className="rq-heading"><div><span className="rq-eyebrow">ESPACE ENSEIGNANT</span><h1 id="rq-title">Demandes d&apos;encadrement</h1><p>Examinez les candidatures et choisissez les projets que vous souhaitez accompagner.</p></div><span className="rq-total"><GraduationCap size={18} />{items.length} demande{items.length !== 1 ? 's' : ''}</span></header>
    <div className="rq-stats">{counts.map(({ label, count, icon: Icon, type }) => <article className={`rq-stat rq-stat-${type}`} key={label}><span className="rq-stat-icon"><Icon size={18} /></span><div><span>{label}</span><strong>{count}</strong></div></article>)}</div>
    <section className="rq-list" aria-label="Liste des demandes"><header className="rq-list-heading"><div><span className="rq-eyebrow">CANDIDATURES REÇUES</span><h2>Toutes les demandes</h2></div><span className="rq-results">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span></header>
      <div className="rq-toolbar"><label className="rq-search"><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par nom, sujet ou institution…" aria-label="Rechercher une demande" /></label><label className="rq-filter"><span>Statut</span><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrer par statut">{options.map((option) => <option key={option}>{option}</option>)}</select></label></div>
      {filtered.length ? <div className="rq-grid">{filtered.map((item) => <article className="rq-card" key={item.id}><header className="rq-card-heading"><span className="rq-avatar">{item.initials}</span><div className="rq-person"><h3>{item.name}</h3><span>{item.specialty}</span></div><RequestStatus status={item.status} /></header><div className="rq-subject"><span>SUJET PROPOSÉ</span><strong>{item.subject}</strong></div><div className="rq-meta"><span><small>Établissement</small><b><UserRound size={13} />{item.institution}</b></span><span><small>Reçue le</small><b>{item.date}</b></span></div>{item.status === 'REQUESTED' && <footer className="rq-actions"><button className="rq-accept" onClick={() => updateStatus(item.id, 'ACCEPTED')}><Check size={15} />Accepter</button><button className="rq-decline" onClick={() => updateStatus(item.id, 'DECLINED')}><X size={15} />Refuser</button></footer>}</article>)}</div> : <div className="rq-empty"><span><Search size={20} /></span><strong>Aucune demande trouvée</strong><p>Modifiez votre recherche ou le filtre de statut.</p><button onClick={() => { setQuery(''); setFilter(options[0]) }}>Effacer les filtres</button></div>}
    </section>
  </section>
}
