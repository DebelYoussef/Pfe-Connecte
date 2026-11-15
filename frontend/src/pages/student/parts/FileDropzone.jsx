import { FileText, Upload, X } from "lucide-react";
import { useId, useState } from "react";
import { buttonDisabled, buttonVariants, card, focusRing, formatBytes } from "./ui";

// Drag-and-drop file picker with type/size checks, a selected-file row and a progress bar.
export default function FileDropzone({
  label,
  hint,
  accept,
  mimeTypes,
  extensions,
  maxBytes,
  typeError,
  sizeError,
  file,
  onFile,
  progress = null,
  disabled = false,
  disabledMessage,
  disabledAction,
  busy = false,
  buttonRef,
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const locked = disabled || busy;

  function pick(candidate) {
    if (!candidate) return;
    const name = candidate.name.toLowerCase();
    const typeOk = mimeTypes.includes(candidate.type) || extensions.some((ext) => name.endsWith(ext));
    if (!typeOk) {
      setError(typeError);
      onFile(null);
      return;
    }
    if (candidate.size > maxBytes) {
      setError(sizeError);
      onFile(null);
      return;
    }
    setError("");
    onFile(candidate);
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!locked) pick(event.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center gap-3 rounded-[4px] border border-dashed px-6 py-8 text-center transition-colors duration-150 ${
          disabled
            ? "cursor-not-allowed border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]"
            : dragging
              ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]"
              : error
                ? "border-[var(--danger)] bg-[var(--surface)]"
                : "border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] bg-[var(--surface)] hover:border-[var(--primary)]"
        }`}
      >
        <span className="grid h-11 w-11 place-items-center rounded-[4px] border border-[var(--border)] bg-[var(--bg)] text-[var(--primary)]">
          <Upload size={20} aria-hidden="true" />
        </span>
        {disabled ? (
          <>
            <p className="m-0 max-w-[420px] text-[13px] text-[var(--muted)]">{disabledMessage}</p>
            {disabledAction}
          </>
        ) : (
          <>
            <div>
              <p className="m-0 text-[14px] font-semibold text-[var(--text)]">{label}</p>
              <p className="m-0 mt-1 text-[12px] text-[var(--muted)]">{hint}</p>
            </div>
            <input
              id={inputId}
              type="file"
              accept={accept}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                pick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              ref={buttonRef}
              type="button"
              className={busy ? buttonDisabled : buttonVariants.secondary}
              aria-disabled={busy || undefined}
              onClick={() => !busy && document.getElementById(inputId)?.click()}
            >
              Choisir un fichier
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 mt-2 text-[12px] text-[var(--danger)]">
          {error}
        </p>
      )}
      {file && !disabled && (
        <div className={`${card} mt-3 flex items-center gap-3 px-3.5 py-3`}>
          <FileText size={20} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] text-[var(--text)]">{file.name}</strong>
            <span className="text-[12px] text-[var(--muted)]">{formatBytes(file.size)}</span>
            {progress !== null && (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-[var(--border)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Progression de l’envoi"
              >
                <span
                  className="block h-full bg-[var(--primary)] transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
          {progress !== null ? (
            <span className="text-[12px] font-semibold text-[var(--primary)]">{progress} %</span>
          ) : (
            <button
              type="button"
              className={`grid h-8 w-8 place-items-center rounded-[4px] border-0 bg-transparent text-[var(--muted)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] hover:text-[var(--danger)] active:translate-y-px ${focusRing}`}
              aria-label="Retirer le fichier"
              title="Retirer le fichier"
              onClick={() => onFile(null)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
