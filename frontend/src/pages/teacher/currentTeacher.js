import { getUser } from '../../auth'

function initialsOf(text) {
  const parts = text.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

export function getCurrentTeacher() {
  const user = getUser() || {}
  const firstName = (user.firstName || '').trim()
  const lastName = (user.lastName || '').trim()
  const email = user.email || ''
  const name = [firstName, lastName].filter(Boolean).join(' ') || email
  return {
    name,
    firstName: firstName || email.split('@')[0] || '',
    lastName,
    email,
    initials: initialsOf(name || email) || 'U',
  }
}
