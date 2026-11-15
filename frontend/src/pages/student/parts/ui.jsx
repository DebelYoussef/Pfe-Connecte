// Shared class strings for the student pages. They only read the existing CSS variables.
// The "!" suffix is needed where the global stylesheet sets `font` on buttons/inputs/headings
// or `color: inherit` on links: those global rules sit outside Tailwind's layers and would win.

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

const buttonBase = `inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] border px-4 text-[13px]! font-semibold! leading-none no-underline select-none cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px ${focusRing}`;

export const buttonVariants = {
  primary: `${buttonBase} border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-contrast)]! hover:border-[var(--primary-hover)] hover:bg-[var(--primary-hover)] active:brightness-95`,
  secondary: `${buttonBase} border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]! hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] active:bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))]`,
  danger: `${buttonBase} border-[var(--border)] bg-[var(--surface)] text-[var(--danger)]! hover:border-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] active:bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))]`,
};

export const buttonDisabled = `inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] border border-[var(--border)] bg-[var(--border)] px-4 text-[13px]! font-semibold! leading-none text-[var(--muted)]! cursor-not-allowed ${focusRing}`;

export const linkButton = `inline-flex items-center gap-1 rounded-[2px] border-0 bg-transparent p-0 text-[12px]! font-semibold! text-[var(--primary)]! underline-offset-2 cursor-pointer hover:underline active:opacity-75 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline ${focusRing}`;

export const card = "rounded-[4px] border border-[var(--border)] bg-[var(--surface)]";

export const sectionTitle =
  "m-0 font-['Source_Serif_4',Georgia,serif]! text-[22px]! leading-[1.2]! font-semibold! text-[var(--text)]";

export const fieldLabel = "mb-1.5 block text-[12px] font-semibold text-[var(--text)]";

export const fieldHint = "mt-1.5 text-[12px] text-[var(--muted)]";

export const fieldError = "mt-1.5 text-[12px] text-[var(--danger)]";

export const input = `block w-full min-h-11 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[14px]! text-[var(--text)] placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] aria-invalid:border-[var(--danger)] ${focusRing}`;

// Add to `input` on fields rendered with readOnly.
export const inputReadOnly = "cursor-default bg-[var(--bg)]! text-[var(--muted)] hover:border-[var(--border)]";

export const quote =
  "m-0 border-l-2 border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] px-3.5 py-2.5 text-[13px] italic text-[var(--text)]";

// Tone colors. Green has no variable in index.css yet, so it falls back to the green already used there.
export const tone = {
  neutral: "border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_10%,transparent)] text-[var(--muted)]",
  primary: "border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]",
  amber: "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--text)]",
  success: "border-[color-mix(in_srgb,var(--success,#2e7d5b)_35%,transparent)] bg-[color-mix(in_srgb,var(--success,#2e7d5b)_11%,transparent)] text-[var(--success,#2e7d5b)]",
  danger: "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-[var(--danger)]",
};

export const chip = "inline-flex items-center gap-1 rounded-[4px] border px-2 py-1 text-[11px] font-semibold leading-none";

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

export function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR", options);
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
