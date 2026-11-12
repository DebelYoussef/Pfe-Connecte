import { ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ActionButton from "./ActionButton";
import { focusRing } from "./ui";

// "Exporter" button with a small menu. Items: [{ label, onSelect }].
export default function ExportMenu({ items, disabledReason }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !wrapRef.current?.contains(event.target) && setOpen(false);
    const escape = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    wrapRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <ActionButton
        variant="secondary"
        disabledReason={disabledReason}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Download size={15} aria-hidden="true" />
        Exporter
        <ChevronDown size={15} aria-hidden="true" />
      </ActionButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[230px] rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
            event.preventDefault();
            const list = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
            const index = list.indexOf(document.activeElement);
            const next = event.key === "ArrowDown" ? index + 1 : index - 1;
            list[(next + list.length) % list.length]?.focus();
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`block w-full rounded-[3px] border-0 bg-transparent px-3 py-2.5 text-left text-[13px]! text-[var(--text)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] hover:text-[var(--primary)] active:bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] ${focusRing}`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
