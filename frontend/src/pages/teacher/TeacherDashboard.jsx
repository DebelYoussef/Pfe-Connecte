import { useMemo, useState } from 'react'
import './teacher.css'
import TeacherStudents from './TeacherStudents'
import TeacherRequests from './TeacherRequests'
import TeacherReports from './TeacherReports'
import TeacherNotifications from './TeacherNotifications'
import TeacherProfile from './TeacherProfile'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../auth'
import { getCurrentTeacher } from './currentTeacher'
import { Bell, BookOpen, Check, ChevronRight, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Search, Settings, Sun, UserRound, Users, X } from 'lucide-react'
import { activities, reports as initialReports, requests as initialRequests, students } from '../../data/teacherMockData'

const navItems = [
  { label: 'Tableau de bord', icon: LayoutDashboard }, { label: 'Mes étudiants', icon: Users }, { label: "Demandes d'encadrement", icon: GraduationCap }, { label: 'Rapports PFE', icon: FileText }, { label: 'Notifications', icon: Bell }, { label: 'Mon profil', icon: UserRound },
]
const statusLabels = { UNDER_REVIEW: 'À examiner', CHANGES_REQUESTED: 'Modifications demandées', VALIDATED: 'Validé', REQUESTED: 'En attente', ACCEPTED: 'Acceptée', DECLINED: 'Refusée' }

function Avatar({ initials, color = '#dbeceb' }) { return <span className="teacher-avatar" style={{ background: color }}>{initials}</span> }
function Status({ value }) { return <span className={`teacher-status status-${value.toLowerCase()}`}><span />{statusLabels[value] || value}</span> }

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const teacher = useMemo(() => getCurrentTeacher(), [])
  const [active, setActive] = useState('Tableau de bord')
  const [unread, setUnread] = useState(3)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Tous les statuts')
  const [requests, setRequests] = useState(initialRequests)
  const [reportData, setReportData] = useState(initialReports)
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const filteredStudents = useMemo(() => students.filter((s) => `${s.name} ${s.subject} ${s.company}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'Tous les statuts' || s.status === filter)), [query, filter])

  function handleLogout() { logout(); navigate('/login', { replace: true }) }
  function handleRequest(id, status) { setRequests((items) => items.map((item) => item.id === id ? { ...item, status } : item)) }
  function handleReport(id, status) { setReportData((items) => items.map((item) => item.id === id ? { ...item, status } : item)) }

  return <div className={`teacher-shell ${dark ? 'teacher-dark' : ''}`}>
    <aside className={`teacher-sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="teacher-brand"><span className="teacher-brand-mark">P</span><span>PFE <b>Connect</b></span></div>
      <div className="sidebar-label">ESPACE ENSEIGNANT</div>
      <nav>{navItems.map(({ label, icon: Icon }) => <button className={active === label ? 'nav-active' : ''} key={label} onClick={() => { setActive(label); setMenuOpen(false) }}><Icon size={17} /><span>{label}</span>{label === 'Notifications' && unread > 0 && <em>{unread}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><Avatar initials={teacher.initials} color="#e9dcbf" /><div><strong>{teacher.name}</strong><small>{teacher.email}</small></div></div><button className="logout" onClick={handleLogout}><LogOut size={16} />Se déconnecter</button></div>
    </aside>
    <main className="teacher-main">
      <header className="teacher-header"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Ouvrir le menu"><Menu size={21} /></button><div className="breadcrumb"><span>Espace enseignant</span><ChevronRight size={14} /><b>{active}</b></div><div className="header-actions"><div className="top-search"><Search size={16} /><input aria-label="Rechercher" placeholder="Rechercher une information" /></div><button className="icon-btn notification-button" onClick={() => setNoticeOpen(!noticeOpen)} aria-label="Notifications"><Bell size={18} /><i /></button><button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Changer de thème">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><Avatar initials={teacher.initials} color="#e9dcbf" />{noticeOpen && <div className="notification-popover"><strong>Notifications</strong><p>3 nouvelles notifications</p><p>Demande de Lina Saïdi</p></div>}</div></header>
      {active === 'Mes étudiants' ? <div className="teacher-content"><TeacherStudents /></div> : active === "Demandes d'encadrement" ? <div className="teacher-content"><TeacherRequests /></div> : active === 'Rapports PFE' ? <div className="teacher-content"><TeacherReports /></div> : <div className="teacher-content" hidden={active !== 'Tableau de bord'}>
        <section className="teacher-welcome"><div><span className="teacher-eyebrow">ESPACE ENSEIGNANT</span><h1>Bonjour, {teacher.firstName}</h1><p>Suivez vos étudiants et accompagnez-les jusqu'à la réussite de leur projet de fin d'études.</p></div><div className="welcome-stamp"><ClipboardCheck size={28} /><span>Année universitaire<br /><b>2024 — 2025</b></span></div></section>
        <section className="teacher-stats">{[[Users, 'Étudiants encadrés', '24', '3 nouveaux ce mois'], [GraduationCap, 'Demandes en attente', '3', 'À traiter rapidement'], [FileText, 'Rapports à examiner', '5', '2 reçus cette semaine'], [Check, 'Rapports validés', '16', 'Cette année']].map(([Icon, label, value, detail], i) => <article key={label} className={`stat-card stat-${i}`}><div className="stat-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><MoreHorizontal size={17} className="stat-more" /></article>)}</section>
        <div className="teacher-grid"><div className="teacher-left">
          <section className="dashboard-section"><div className="section-heading"><div><span className="teacher-eyebrow">VOTRE SUIVI</span><h2>Mes étudiants</h2></div><button className="text-link" onClick={() => setActive('Mes étudiants')} aria-label="Voir tous les étudiants">Voir tous <ChevronRight size={15} /></button></div><div className="table-toolbar"><div className="field-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un étudiant..." /></div><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>Tous les statuts</option><option>En cours</option><option>Rapport à examiner</option><option>Validé</option><option>En attente</option></select></div><div className="table-wrap"><table><thead><tr><th>Étudiant</th><th>Sujet PFE</th><th>Entreprise</th><th>Spécialité</th><th>Statut</th><th /></tr></thead><tbody>{filteredStudents.map((student) => <tr key={student.id}><td><div className="person-cell"><Avatar initials={student.initials} color={student.color} /><strong>{student.name}</strong></div></td><td className="subject-cell">{student.subject}</td><td>{student.company}</td><td>{student.specialty}</td><td><Status value={student.status === 'En cours' ? 'ACCEPTED' : student.status === 'Validé' ? 'VALIDATED' : student.status === 'Rapport à examiner' ? 'UNDER_REVIEW' : 'REQUESTED'} /></td><td><button className="row-action" aria-label={`Voir ${student.name}`} onClick={() => alert(`Dossier de ${student.name}`)}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Affichage de {filteredStudents.length} étudiants sur 24</span><div><button className="page-button">‹</button><button className="page-button active-page">1</button><button className="page-button">2</button><button className="page-button">›</button></div></div></section>
          <section className="dashboard-section requests-section"><div className="section-heading"><div><span className="teacher-eyebrow">À DÉCIDER</span><h2>Demandes d'encadrement</h2></div><button className="text-link" onClick={() => setActive("Demandes d'encadrement")}>Voir toutes <ChevronRight size={15} /></button></div><div className="request-list">{requests.map((request) => <div className="request-row" key={request.id}><Avatar initials={request.initials} color="#e4e9e7" /><div className="request-info"><strong>{request.name}</strong><span>{request.specialty} · {request.subject}</span><small>{request.institution} · {request.date}</small></div>{request.status === 'REQUESTED' ? <div className="request-actions"><button className="btn-accept" onClick={() => handleRequest(request.id, 'ACCEPTED')}><Check size={14} />Accepter</button><button className="btn-decline" onClick={() => handleRequest(request.id, 'DECLINED')}><X size={14} />Refuser</button></div> : <Status value={request.status} />}</div>)}</div></section>
          <section className="dashboard-section"><div className="section-heading"><div><span className="teacher-eyebrow">DOCUMENTS RÉCENTS</span><h2>Rapports PFE</h2></div><button className="text-link" onClick={() => setActive('Rapports PFE')}>Voir tous <ChevronRight size={15} /></button></div><div className="table-wrap"><table><thead><tr><th>Étudiant</th><th>Titre du rapport</th><th>Date</th><th>Entreprise</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{reportData.map((report) => <tr key={report.id}><td><div className="person-cell"><Avatar initials={report.initials} color="#e7e8e2" /><strong>{report.student}</strong></div></td><td className="subject-cell">{report.title}</td><td>{report.date}</td><td>{report.company}</td><td><Status value={report.status} /></td><td><button className="report-action" onClick={() => report.status === 'UNDER_REVIEW' ? handleReport(report.id, 'VALIDATED') : handleReport(report.id, 'CHANGES_REQUESTED')}>{report.status === 'UNDER_REVIEW' ? 'Valider' : 'Consulter'}</button></td></tr>)}</tbody></table></div></section>
        </div><TeacherRightPanel /></div>
      </div>}
      <div className="teacher-content" hidden={active !== 'Notifications'}><TeacherNotifications onUnreadChange={setUnread} /></div>
      <div className="teacher-content" hidden={active !== 'Mon profil'}><TeacherProfile /></div>
    </main>
  </div>
}

function TeacherRightPanel() { return <aside className="teacher-right"><section className="side-card"><div className="side-title"><h3>À traiter</h3><span>8</span></div><div className="todo-item"><span className="todo-dot gold" /><div><strong>Demandes d'encadrement</strong><small>3 nouvelles demandes</small></div><ChevronRight size={15} /></div><div className="todo-item"><span className="todo-dot teal" /><div><strong>Rapports à examiner</strong><small>5 rapports en attente</small></div><ChevronRight size={15} /></div></section><section className="side-card"><div className="side-title"><h3>Activité récente</h3><button>Tout voir</button></div>{activities.map((activity) => <div className="activity-item" key={activity.title}><span className={`activity-icon ${activity.type}`}><FileText size={14} /></span><div><strong>{activity.title}</strong><small>{activity.text}</small><em>{activity.time}</em></div></div>)}</section><section className="reminder-card"><span className="teacher-eyebrow">PROCHAIN RAPPEL</span><h3>Journée de soutenance</h3><p>Préparation des jurys et calendriers</p><div className="reminder-date"><strong>27</strong><span>JUIN<br /><b>2025</b></span></div><button>Voir le calendrier <ChevronRight size={15} /></button></section></aside> }