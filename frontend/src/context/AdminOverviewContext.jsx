import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getOverview } from "../services.admin";

const AdminOverviewContext = createContext(null);

export function AdminOverviewProvider({ children }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const overviewRef = useRef(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    if (!overviewRef.current) setLoading(true);
    setError(null);
    try {
      const data = await getOverview();
      if (requestId.current === currentRequest) {
        overviewRef.current = data;
        setOverview(data);
      }
      return data;
    } catch (loadError) {
      if (requestId.current === currentRequest) setError(loadError);
      return null;
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refreshIfActive = () => {
      if (active && !document.hidden) {
        void Promise.resolve().then(() => refresh());
      }
    };
    const timer = window.setInterval(refreshIfActive, 60000);
    window.addEventListener("focus", refreshIfActive);
    window.addEventListener("pfe:admin-data-changed", refreshIfActive);
    document.addEventListener("visibilitychange", refreshIfActive);
    void Promise.resolve().then(() => {
      if (active) return refresh();
      return null;
    });
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfActive);
      window.removeEventListener("pfe:admin-data-changed", refreshIfActive);
      document.removeEventListener("visibilitychange", refreshIfActive);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ overview, loading, error, refresh }),
    [overview, loading, error, refresh],
  );
  return (
    <AdminOverviewContext.Provider value={value}>
      {children}
    </AdminOverviewContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminOverview() {
  const context = useContext(AdminOverviewContext);
  if (!context) {
    throw new Error("useAdminOverview doit être utilisé dans AdminOverviewProvider.");
  }
  return context;
}
