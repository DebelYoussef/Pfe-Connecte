import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, Check, CheckCheck, FileCheck2, FileText, GraduationCap, Inbox, MessageSquareText } from 'lucide-react'
import './teacherNotifications.css'

const notificationExamples = [
  { id: 1, type: 'request', title: 'Nouvelle demande d’encadrement', message: 'Lina Saïdi souhaite vous confier le suivi de son projet de détection des fraudes.', time: 'Il y a 2 h', unread: true },
  { id: 2, type: 'report', title: 'Rapport soumis', message: 'Omar Rahmani a soumis une nouvelle version de son rapport de PFE.', time: 'Il y a 5 h', unread: true },
  { id: 3, type: 'validated', title: 'Rapport validé', message: 'Le rapport de Mehdi Kaci a été validé. Félicitations pour cette étape !', time: 'Hier, 16:42', unread: true },
  { id: 4, type: 'reminder', title: 'Rappel de soutenance', message: 'La journée de soutenance est prévue le 27 juin 2025. Pensez à finaliser les jurys.', time: '12 juin 2025', unread: false },
  { id: 5, type: 'report', title: 'Document ajouté au dossier', message: 'Yasmine Haddad a ajouté une pièce complémentaire à son dossier de stage.', time: '10 juin 2025', unread: false },
  { id: 6, type: 'request', title: 'Demande acceptée', message: 'Votre accompagnement de Sara Meziane a bien été confirmé.', time: '8 juin 2025', unread: false },
  { id: 7, type: 'message', title: 'Commentaire sur un rapport', message: 'Un nouveau commentaire est disponible dans le suivi des rapports PFE.', time: '5 juin 2025', unread: false },
]

const notificationTypes = {
  request: { icon: GraduationCap, className: 'nt-icon-request' },
  report: { icon: FileText, className: 'nt-icon-report' },
  validated: { icon: FileCheck2, className: 'nt-icon-validated' },
  reminder: { icon: CalendarDays, className: 'nt-icon-reminder' },
  message: { icon: MessageSquareText, className: 'nt-icon-message' },
}

export default function TeacherNotifications({ onUnreadChange }) {
  const [notifications, setNotifications] = useState(notificationExamples)
  const [tab, setTab] = useState('all')
  const unreadCount = notifications.filter((notification) => notification.unread).length
  const visibleNotifications = useMemo(() => tab === 'unread' ? notifications.filter((notification) => notification.unread) : notifications, [notifications, tab])

  useEffect(() => {
    onUnreadChange?.(unreadCount)
  }, [onUnreadChange, unreadCount])

  function markRead(id) {
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, unread: false } : notification))
  }

  function markAllRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, unread: false })))
  }

  return <section className="nt-page" aria-labelledby="nt-title">
    <header className="nt-heading"><div><span className="nt-eyebrow">ESPACE ENSEIGNANT</span><h1 id="nt-title">Notifications</h1><p>Retrouvez les nouvelles demandes, les rapports et les rappels liés à vos projets.</p></div><span className="nt-count"><Bell size={18} />{unreadCount} non lue{unreadCount !== 1 ? 's' : ''}</span></header>
    <section className="nt-list" aria-label="Centre de notifications">
      <div className="nt-list-heading"><div><span className="nt-eyebrow">VOTRE ACTIVITÉ</span><h2>Centre de notifications</h2></div><button className="nt-mark-all" type="button" onClick={markAllRead} disabled={unreadCount === 0}><CheckCheck size={15} />Tout marquer comme lu</button></div>
      <div className="nt-toolbar"><div className="nt-tabs" role="tablist" aria-label="Filtrer les notifications"><button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'nt-tab nt-tab-active' : 'nt-tab'} onClick={() => setTab('all')}>Toutes <span>{notifications.length}</span></button><button type="button" role="tab" aria-selected={tab === 'unread'} className={tab === 'unread' ? 'nt-tab nt-tab-active' : 'nt-tab'} onClick={() => setTab('unread')}>Non lues <span>{unreadCount}</span></button></div><span className="nt-result-count">{visibleNotifications.length} notification{visibleNotifications.length !== 1 ? 's' : ''}</span></div>
      {visibleNotifications.length ? <div className="nt-items">{visibleNotifications.map((notification) => {
        const { icon: Icon, className } = notificationTypes[notification.type]
        return <button type="button" className={`nt-item ${notification.unread ? 'nt-item-unread' : ''}`} key={notification.id} onClick={() => notification.unread && markRead(notification.id)} aria-label={`${notification.unread ? 'Marquer comme lue : ' : ''}${notification.title}`}>
          <span className={`nt-icon ${className}`}><Icon size={18} /></span><span className="nt-item-body"><span className="nt-item-top"><strong>{notification.title}</strong>{notification.unread && <span className="nt-unread-dot" aria-label="Non lue" />}</span><span className="nt-message">{notification.message}</span><span className="nt-time">{notification.time}</span></span>{notification.unread && <span className="nt-mark-icon" aria-hidden="true"><Check size={14} /></span>}
        </button>
      })}</div> : <div className="nt-empty"><span className="nt-empty-icon"><Inbox size={21} /></span><strong>Tout est à jour</strong><p>Vous n’avez aucune notification non lue.</p></div>}
    </section>
  </section>
}
