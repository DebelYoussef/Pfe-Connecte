import { useCallback, useEffect, useState } from "react";
import { getMyConvention, getMySupervision } from "../services";
export default function useInternshipStatus() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    convention: null,
    supervision: null,
  });
  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.all([getMyConvention(), getMySupervision()])
      .then(([convention, supervision]) =>
        setState({ loading: false, error: null, convention, supervision }),
      )
      .catch((error) => setState((s) => ({ ...s, loading: false, error })));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const status =
    state.convention?.state === "APPROVED"
      ? "approved"
      : state.convention
        ? "pending"
        : "none";
  return { ...state, status, refresh };
}
