import { Building2, Home, Shuffle } from 'lucide-react'

export const WORK_MODES = [
  { value: 'ONSITE', label: 'Sur site', Icon: Building2 },
  { value: 'HYBRID', label: 'Hybride', Icon: Shuffle },
  { value: 'REMOTE', label: 'Télétravail', Icon: Home },
]

const modesByValue = Object.fromEntries(WORK_MODES.map((mode) => [mode.value, mode]))

export function getWorkModeLabel(value) {
  return modesByValue[value]?.label ?? 'Mode non précisé'
}

export default function WorkModeBadge({ mode, className = '' }) {
  const { label, Icon } = modesByValue[mode] ?? modesByValue.ONSITE

  return (
    <span className={`work-mode-badge work-mode-${String(mode || 'ONSITE').toLowerCase()} ${className}`.trim()}>
      <Icon aria-hidden="true" size={14} />
      <span>{label}</span>
    </span>
  )
}
