import { Check } from 'lucide-react'
import Tooltip from './Tooltip'

export default function OfferActionButton({ offer, application, activeCount, onApply, className = '' }) {
  const classes = `offer-apply-button ${className}`.trim()

  if (application) {
    return (
      <button type="button" className={`${classes} is-applied`} disabled>
        <Check aria-hidden="true" size={15} />
        Déjà postulé
      </button>
    )
  }

  if (activeCount >= 5) {
    return (
      <Tooltip content="Vous avez atteint la limite de 5 candidatures actives.">
        <span className="offer-action-tooltip-target">
          <button type="button" className={classes} disabled>Limite atteinte (5/5)</button>
        </span>
      </Tooltip>
    )
  }

  if (offer.status !== 'OPEN') {
    return (
      <Tooltip content="Cette offre n’accepte plus de candidatures.">
        <span className="offer-action-tooltip-target">
          <button type="button" className={classes} disabled>Indisponible</button>
        </span>
      </Tooltip>
    )
  }

  return <button type="button" className={classes} onClick={onApply}>Postuler</button>
}
