import { useEffect } from "react";

// Shows the browser's "leave this page?" prompt while `active` is true.
export default function useUnsavedWarning(active) {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
