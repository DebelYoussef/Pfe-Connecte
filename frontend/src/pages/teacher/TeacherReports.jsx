import { useMemo, useState } from 'react'
import { Check, FileText, Search, X } from 'lucide-react'
import { reports as initialReports } from '../../data/teacherMockData'
import './teacherReports.css'

const labels = { UNDER_REVIEW: 'À examiner', VALIDATED: 'Validé', CHANGES_REQUESTED: 'Modifications demandées' }
const options = ['Tous les statuts', ...Object.values(labels)]

function ReportStatus({ status }) {
  const kind = status === 'UNDER_REVIEW' ? 'review' : status === 'VALIDATED' ? 'validated' : 'changes'
  return <span className={`rp-badge rp-badge-${kind}`}><i />{labels[status]}</span>
}

export default function TeacherReports() {
  const [items, setItems] = useState(initialReports)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(options[0])
  const [selected, setSelected] = useState(null)
  const filtered = useMemo(() => items.filter((item) => {
    const term = query.trim().toLocaleLowerCase('fr')
    return `${item.student} ${item.title} ${item.company}`.toLocaleLowerCase('fr').includes(term) && (filter === options[0] || labels[item.status] === filter)
  }), [items, query, filter])
  const stats = [
    { label: 'Total des rapports', count: items.length, type: 'teal' },
    { label: 'À examiner', count: items.filter((item) => item.status === 'UNDER_REVIEW').length, type: 'gold' },
    { label: 'Validés', count: items.filter((item) => item.status === 'VALIDATED').length, type: 'green' },
    { label: 'Modifications demandées', count: items.filter((item) => item.status === 'CHANGES_REQUESTED').length, type: 'slate' },
  ]
  const updateStatus = (id, status) => setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))

  return <section className="rp-page" aria-labelledby="rp-title">
    <header className="rp-heading"><div><span className="rp-eyebrow">ESPACE ENSEIGNANT</span><h1 id="rp-title">Rapports PFE</h1><p>Consultez les rapports soumis et accompagnez chaque étudiant jusqu’à la validation finale.</p></div><span className="rp-total"><FileText size={18} />{items.length} rapport{items.length !== 1 ? 's' : ''}</span></header>
    <div className="rp-stats">{stats.map(({ label, count, type }) => <article className={`rp-stat rp-stat-${type}`} key={label}><span className="rp-stat-icon"><FileText size={18} /></span><div><span>{label}</span><strong>{count}</strong></div></article>)}</div>
    <section className="rp-list" aria-label="Liste des rapports"><header className="rp-list-heading"><div><span className="rp-eyebrow">SUIVI DES DOCUMENTS</span><h2>Tous les rapports</h2></div><span className="rp-results">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span></header>
      <div className="rp-toolbar"><label className="rp-search"><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par étudiant, titre ou entreprise…" aria-label="Rechercher un rapport" /></label><label className="rp-filter"><span>Statut</span><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrer par statut">{options.map((option) => <option key={option}>{option}</option>)}</select></label></div>
      {filtered.length ? <div className="rp-table-wrap"><table className="rp-table"><thead><tr><th>Étudiant</th><th>Titre du rapport</th><th>Date</th><th>Entreprise</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><span className="rp-student"><span className="rp-avatar">{item.initials}</span><strong>{item.student}</strong></span></td><td className="rp-title-cell">{item.title}</td><td>{item.date}</td><td>{item.company}</td><td><ReportStatus status={item.status} /></td><td><div className="rp-actions">{item.status === 'UNDER_REVIEW' ? <><button className="rp-validate" onClick={() => updateStatus(item.id, 'VALIDATED')}><Check size={14} />Valider</button><button className="rp-request-changes" onClick={() => updateStatus(item.id, 'CHANGES_REQUESTED')}><X size={14} />Demander des modifications</button></> : <button className="rp-consult" onClick={() => setSelected(item)}>Consulter</button>}</div></td></tr>)}</tbody></table><div className="rp-mobile-list">{filtered.map((item) => <article className="rp-mobile-card" key={item.id}><header><span className="rp-avatar">{item.initials}</span><div><strong>{item.student}</strong><span>{item.company}</span></div><ReportStatus status={item.status} /></header><h3>{item.title}</h3><p>{item.date}</p><div className="rp-actions">{item.status === 'UNDER_REVIEW' ? <><button className="rp-validate" onClick={() => updateStatus(item.id, 'VALIDATED')}><Check size={14} />Valider</button><button className="rp-request-changes" onClick={() => updateStatus(item.id, 'CHANGES_REQUESTED')}><X size={14} />Demander des modifications</button></> : <button className="rp-consult" onClick={() => setSelected(item)}>Consulter</button>}</div></article>)}</div></div> : <div className="rp-empty"><span><Search size={20} /></span><strong>Aucun rapport trouvé</strong><p>Modifiez votre recherche ou le filtre de statut.</p><button onClick={() => { setQuery(''); setFilter(options[0]) }}>Effacer les filtres</button></div>}
    </section>
    {selected && <div className="rp-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="rp-modal" role="dialog" aria-modal="true" aria-labelledby="rp-modal-title"><header><div><span className="rp-eyebrow">DÉTAIL DU RAPPORT</span><h2 id="rp-modal-title">{selected.title}</h2></div><button className="rp-modal-close" aria-label="Fermer" onClick={() => setSelected(null)}><X size={18} /></button></header><dl><div><dt>Étudiant</dt><dd>{selected.student}</dd></div><div><dt>Titre</dt><dd>{selected.title}</dd></div><div><dt>Entreprise</dt><dd>{selected.company}</dd></div><div><dt>Date de soumission</dt><dd>{selected.date}</dd></div><div><dt>Statut</dt><dd><ReportStatus status={selected.status} /></dd></div></dl><footer><button onClick={() => setSelected(null)}>Fermer</button></footer></section></div>}
  </section>
}
