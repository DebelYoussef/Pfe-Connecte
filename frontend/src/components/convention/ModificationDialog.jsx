import ConfirmDialog from "../ui/ConfirmDialog";

export default function ModificationDialog({
  open,
  counterpart = "l’entreprise",
  busy = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;
  return (
    <ConfirmDialog
      open
      title="Demander une modification ?"
      body={`Modifier votre convention annule toutes les signatures. Elle repasse en brouillon et doit être signée à nouveau par ${counterpart} et le responsable.`}
      acknowledgementLabel="Je comprends"
      confirmLabel={busy ? "Demande en cours…" : "Continuer"}
      confirmDisabled={busy}
      confirmTooltip="Confirmez votre demande de modification."
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
