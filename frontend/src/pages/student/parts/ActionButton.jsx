import { LoaderCircle } from "lucide-react";
import Tooltip from "../../../components/ui/Tooltip";
import { buttonDisabled, buttonVariants } from "./ui";

// Button that stays focusable when unavailable so its tooltip can explain why.
export default function ActionButton({
  variant = "primary",
  disabledReason,
  loading = false,
  className = "",
  type = "button",
  onClick,
  children,
  ...props
}) {
  const blocked = Boolean(disabledReason) || loading;
  const look = disabledReason && !loading ? buttonDisabled : buttonVariants[variant];
  const button = (
    <button
      type={type}
      className={`${look} ${loading ? "cursor-wait! opacity-80" : ""} ${className}`}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />}
      {children}
    </button>
  );
  if (disabledReason && !loading) return <Tooltip content={disabledReason}>{button}</Tooltip>;
  return button;
}
