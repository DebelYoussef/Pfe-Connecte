import { useEffect, useId, useRef, useState } from 'react'

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  confirmDisabled = false,
  acknowledgementLabel,
}) {
  const ref = useRef(null)
  const acknowledgementId = useId()
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (!open) return
    setAcknowledged(false)
    ref.current?.focus()
    const close = (event) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" tabIndex="-1" ref={ref}>
        <h2 id="confirm-title">{title}</h2>
        <p>{body}</p>
        {acknowledgementLabel && (
          <label className="confirm-acknowledgement" htmlFor={acknowledgementId}>
            <input id={acknowledgementId} type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span>{acknowledgementLabel}</span>
          </label>
        )}
        <div>
          <button className="modal-cancel" type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className="modal-confirm" type="button" disabled={confirmDisabled || (Boolean(acknowledgementLabel) && !acknowledged)} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
