import ConfirmDialog from "../ui/ConfirmDialog";

export default function SignDialog({
  open,
  fingerprint,
  busy = false,
  canConfirm = true,
  confirmTooltip = "Vérifiez que la convention est complète et enregistrée.",
  title = "Signer la convention",
  body,
  acknowledgementLabel = "J’ai relu la convention et je la signe électroniquement",
  confirmLabel = busy ? "Signature…" : "Signer électroniquement",
  showFingerprintBlock = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;
  return (
    <ConfirmDialog
      open
      title={title}
      body={body || `Après votre signature, le document est figé.\nEmpreinte du document : ${fingerprint || "—"}`}
      acknowledgementLabel={acknowledgementLabel}
      confirmLabel={confirmLabel}
      confirmDisabled={busy || !canConfirm}
      confirmTooltip={confirmTooltip}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {showFingerprintBlock && (
        <div className="convention-sign-fingerprint">
          <span>Empreinte du document</span>
          <code>{fingerprint || "—"}</code>
        </div>
      )}
    </ConfirmDialog>
  );
}
