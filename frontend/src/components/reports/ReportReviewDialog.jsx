import ConfirmDialog from "../ui/ConfirmDialog";

export default function ReportReviewDialog({
  open,
  decision,
  comment,
  onCommentChange,
  busy,
  onCancel,
  onConfirm,
}) {
  const requestingChanges = decision === "CHANGES_REQUESTED";
  const commentMissing = requestingChanges && !comment.trim();
  return (
    <ConfirmDialog
      open={open}
      title={
        requestingChanges
          ? "Demander des modifications ?"
          : "Approuver ce rapport ?"
      }
      body={
        requestingChanges
          ? "Indiquez les modifications attendues. Un commentaire est obligatoire."
          : "Votre avis sera enregistré pour la dernière version du rapport."
      }
      confirmLabel={
        busy
          ? "Enregistrement…"
          : requestingChanges
            ? "Envoyer la demande"
            : "Approuver"
      }
      confirmDisabled={busy || commentMissing}
      confirmTooltip={
        busy
          ? "Enregistrement en cours."
          : commentMissing
            ? "Un commentaire est obligatoire."
            : undefined
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {requestingChanges && (
        <label className="teacher-review-comment">
          <span>Commentaire requis</span>
          <textarea
            value={comment}
            maxLength={2000}
            rows={5}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Décrivez les modifications attendues…"
          />
          <small>{comment.length} / 2000</small>
        </label>
      )}
    </ConfirmDialog>
  );
}
