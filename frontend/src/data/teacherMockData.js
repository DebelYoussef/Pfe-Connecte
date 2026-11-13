export const teacher = { name: 'Nadia Benali', firstName: 'Nadia', email: 'nadia.benali@ens.edu' }

export const students = [
  { id: 1, name: 'Yasmine Haddad', initials: 'YH', subject: 'Plateforme de suivi des stages', company: 'Sopra HR', specialty: 'Génie logiciel', status: 'En cours', color: '#dbeceb' },
  { id: 2, name: 'Omar Rahmani', initials: 'OR', subject: 'Optimisation des flux logistiques', company: 'Cevital', specialty: 'Data & IA', status: 'Rapport à examiner', color: '#f6e8c9' },
  { id: 3, name: 'Lina Saïdi', initials: 'LS', subject: 'Système de détection des fraudes', company: 'BNP Paribas', specialty: 'Cybersécurité', status: 'En attente', color: '#e6e9eb' },
  { id: 4, name: 'Mehdi Kaci', initials: 'MK', subject: 'Application mobile de santé', company: 'Doctolib', specialty: 'Génie logiciel', status: 'Validé', color: '#e0eee6' },
]

export const requests = [
  { id: 1, name: 'Lina Saïdi', initials: 'LS', specialty: 'Cybersécurité', subject: 'Système de détection des fraudes', institution: 'ENS Alger', date: 'Aujourd’hui', status: 'REQUESTED' },
  { id: 2, name: 'Karim Boudiaf', initials: 'KB', specialty: 'Data & IA', subject: 'Prédiction de la consommation énergétique', institution: 'USTHB', date: 'Hier', status: 'REQUESTED' },
  { id: 3, name: 'Sara Meziane', initials: 'SM', specialty: 'Génie logiciel', subject: 'Modernisation d’un portail étudiant', institution: 'ENS Alger', date: '12 juin 2025', status: 'ACCEPTED' },
]

export const reports = [
  { id: 1, student: 'Omar Rahmani', initials: 'OR', title: 'Optimisation des flux logistiques', date: '14 juin 2025', company: 'Cevital', status: 'UNDER_REVIEW' },
  { id: 2, student: 'Mehdi Kaci', initials: 'MK', title: 'Application mobile de santé', date: '08 juin 2025', company: 'Doctolib', status: 'VALIDATED' },
  { id: 3, student: 'Yasmine Haddad', initials: 'YH', title: 'Plateforme de suivi des stages', date: '03 juin 2025', company: 'Sopra HR', status: 'CHANGES_REQUESTED' },
]

export const activities = [
  { type: 'request', title: 'Nouvelle demande d’encadrement', text: 'Lina Saïdi souhaite être encadrée', time: 'Il y a 2 h' },
  { type: 'report', title: 'Rapport soumis', text: 'Omar Rahmani a soumis son rapport', time: 'Il y a 5 h' },
  { type: 'validated', title: 'Rapport validé', text: 'Le rapport de Mehdi Kaci est validé', time: 'Hier, 16:42' },
]
