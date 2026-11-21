import ConfirmDialog from "../ui/ConfirmDialog";

export default function SignDialog({
  open,
  fingerprint,
  busy = false,
  canConfirm = true,
  confirmTooltip = "Vérifiez que la convention est complète et enregistrée.",
  onCancel,
  onConfirm,
}) {
  if (!open) return null;
  return (
    <ConfirmDialog
      open
      title="Signer la convention"
      body={`Après votre signature, le document est figé.\nEmpreinte du document : ${fingerprint || "—"}`}
      acknowledgementLabel="J’ai relu la convention et je la signe électroniquement"
      confirmLabel={busy ? "Signature…" : "Signer électroniquement"}
      confirmDisabled={busy || !canConfirm}
      confirmTooltip={confirmTooltip}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
