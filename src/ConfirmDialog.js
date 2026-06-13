import './ConfirmDialog.css'

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  danger       = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">{danger ? '⚠️' : 'ℹ️'}</div>
        <h3 className="confirm-title">{title}</h3>
        {message && <p className="confirm-message">{message}</p>}
        {detail  && <p className="confirm-detail">{detail}</p>}
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onCancel}>{cancelLabel}</button>
          <button className={`confirm-ok-btn ${danger ? 'danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
