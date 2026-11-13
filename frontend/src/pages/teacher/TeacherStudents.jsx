import { useMemo, useState } from 'react'
import { BookOpen, Check, FileText, Search, Users } from 'lucide-react'
import { students } from '../../data/teacherMockData'
import './teacherStudents.css'

const statusOptions = ['Tous les statuts', ...new Set(students.map((student) => student.status))]
const isReview = (student) => student.status === 'Rapport à examiner'
const isValidated = (student) => student.status === 'Validé'
const isInProgress = (student) => student.status === 'En cours'

function StudentStatus({ student }) {
  const type = isValidated(student) ? 'validated' : isReview(student) ? 'review' : isInProgress(student) ? 'progress' : 'waiting'
  return <span className={`ts-status ts-status-${type}`}><i />{student.status}</span>
}

export default function TeacherStudents() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Tous les statuts')
  const filteredStudents = useMemo(() => students.filter((student) => {
    const matchesQuery = `${student.name} ${student.subject} ${student.company}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))
    return matchesQuery && (status === 'Tous les statuts' || student.status === status)
  }), [query, status])

  const stats = [
    { label: 'Total étudiants', value: students.length, icon: Users, type: 'teal' },
    { label: 'En cours', value: students.filter(isInProgress).length, icon: BookOpen, type: 'gold' },
    { label: 'Rapports à examiner', value: students.filter(isReview).length, icon: FileText, type: 'slate' },
    { label: 'Validés', value: students.filter(isValidated).length, icon: Check, type: 'green' },
  ]

  return <section className="ts-page" aria-labelledby="ts-title">
    <header className="ts-heading"><div><span className="ts-eyebrow">ESPACE ENSEIGNANT</span><h1 id="ts-title">Mes étudiants</h1><p>Retrouvez les étudiants que vous accompagnez et suivez l’avancement de leurs projets de fin d’études.</p></div><span className="ts-count"><Users size={18} />{students.length} étudiant{students.length > 1 ? 's' : ''}</span></header>
    <div className="ts-stats">{stats.map(({ label, value, icon: Icon, type }) => <article className={`ts-stat ts-stat-${type}`} key={label}><span className="ts-stat-icon"><Icon size={18} /></span><div><span className="ts-stat-label">{label}</span><strong>{value}</strong></div></article>)}</div>
    <section className="ts-list" aria-label="Liste des étudiants"><div className="ts-list-heading"><div><span className="ts-eyebrow">VOTRE PORTEFEUILLE</span><h2>Liste des étudiants</h2></div><span className="ts-result-count">{filteredStudents.length} résultat{filteredStudents.length !== 1 ? 's' : ''}</span></div>
      <div className="ts-toolbar"><label className="ts-search"><Search size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par nom, sujet ou entreprise…" aria-label="Rechercher un étudiant par nom, sujet ou entreprise" /></label><label className="ts-filter"><span>Statut</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer les étudiants par statut">{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label></div>
      {filteredStudents.length ? <div className="ts-grid">{filteredStudents.map((student) => <article className="ts-card" key={student.id}><header className="ts-card-header"><span className="ts-avatar" style={{ '--ts-avatar-color': student.color }}>{student.initials}</span><div className="ts-student-name"><h3>{student.name}</h3><span>{student.specialty}</span></div><StudentStatus student={student} /></header><div className="ts-card-subject"><span>Sujet PFE</span><strong>{student.subject}</strong></div><footer className="ts-card-footer"><span>Entreprise</span><strong>{student.company}</strong></footer></article>)}</div> : <div className="ts-empty"><span className="ts-empty-icon"><Search size={20} /></span><strong>Aucun étudiant trouvé</strong><p>Modifiez votre recherche ou choisissez un autre statut.</p><button type="button" onClick={() => { setQuery(''); setStatus('Tous les statuts') }}>Effacer les filtres</button></div>}
    </section>
  </section>
}
