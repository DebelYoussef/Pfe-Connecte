export function CompanyAvatar({ name = '' }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = (parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : (parts[0] || '').slice(0, 2)
  ).toLocaleUpperCase('fr')

  return <span className="company-person-avatar" aria-hidden="true">{initials}</span>
}

export function CompanyMetricCard({ icon: Icon, label, value, note, tone = 'teal' }) {
  return (
    <article className={`rp-stat rp-stat-${tone} company-stat-card`}>
      <span className="rp-stat-icon company-stat-icon">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </article>
  )
}
