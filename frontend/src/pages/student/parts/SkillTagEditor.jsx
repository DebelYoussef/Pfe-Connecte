import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import Tooltip from "../../../components/ui/Tooltip";
import { chip, focusRing, input as inputClass, tone } from "./ui";

export const normalizeSkill = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export default function SkillTagEditor({ values, onChange, suggestions = [], max = 10, inputId }) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const hintId = useId();
  const full = values.length >= max;

  function add(raw) {
    const skill = normalizeSkill(raw);
    setText("");
    if (!skill) return;
    if (values.includes(skill)) {
      setMessage("Cette compétence est déjà ajoutée.");
      return;
    }
    if (full) {
      setMessage(`${max} compétences maximum`);
      return;
    }
    setMessage("");
    onChange([...values, skill]);
  }

  function remove(skill) {
    setMessage("");
    onChange(values.filter((item) => item !== skill));
  }

  const remaining = suggestions.filter((item) => !values.includes(normalizeSkill(item)));

  return (
    <div>
      <div
        className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 focus-within:border-[var(--primary)]`}
      >
        {values.map((skill) => (
          <span key={skill} className={`${chip} ${tone.primary} py-0.5 pr-0.5`}>
            {skill}
            <Tooltip content="Retirer">
              <button
                type="button"
                aria-label={`Retirer ${skill}`}
                className={`grid h-5 w-5 place-items-center rounded-[3px] border-0 bg-transparent text-[var(--primary)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] active:translate-y-px ${focusRing}`}
                onClick={() => remove(skill)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </Tooltip>
          </span>
        ))}
        <input
          id={inputId}
          value={text}
          aria-describedby={hintId}
          placeholder={full ? "" : values.length ? "Ajouter…" : "Ex. react, sql, docker"}
          className={`${inputClass} min-h-8! min-w-[140px] flex-1 border-0! bg-transparent! px-1! focus-visible:outline-0!`}
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(",")) {
              value.split(",").slice(0, -1).forEach(add);
              setText(value.split(",").pop());
            } else setText(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(text);
            } else if (event.key === "Backspace" && !text && values.length) {
              remove(values[values.length - 1]);
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      <p id={hintId} className={`m-0 mt-1.5 text-[12px] ${message ? "text-[var(--danger)]" : "text-[var(--muted)]"}`} role={message ? "alert" : undefined}>
        {message || `Entrée ou virgule pour ajouter · ${values.length} / ${max}`}
      </p>
      {remaining.length > 0 && (
        <div className="mt-3">
          <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {remaining.map((item) => (
              <button
                key={item}
                type="button"
                className={`${chip} border-[var(--border)] bg-[var(--surface)] text-[11px]! text-[var(--muted)] cursor-pointer hover:border-[var(--primary)] hover:text-[var(--primary)] active:translate-y-px ${focusRing}`}
                onClick={() => add(item)}
              >
                <Plus size={11} aria-hidden="true" />
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
