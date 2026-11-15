import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  listNotifications as listStudentNotifications,
  markNotificationRead as markStudentNotificationRead,
} from "../services";
const Context = createContext(null);
const studentService = {
  listNotifications: listStudentNotifications,
  markNotificationRead: markStudentNotificationRead,
};

export function NotificationsProvider({ children, service = studentService }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await service.listNotifications();
        setItems(data.items);
        return data;
      } catch (loadError) {
        setError(loadError);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [service],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const unread = items.filter((item) => !item.read).length;
  const markRead = useCallback(async (id) => {
    await service.markNotificationRead(id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, [service]);
  const markAll = useCallback(async () => {
    await Promise.all(
      items
        .filter((item) => !item.read)
        .map((item) => service.markNotificationRead(item.id)),
    );
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  }, [items, service]);
  const value = useMemo(
    () => ({
      items,
      unread,
      unreadCount: unread,
      loading,
      error,
      markRead,
      markAll,
      refresh: load,
    }),
    [items, unread, loading, error, markRead, markAll, load],
  );
  return (
    <Context.Provider value={value}>{children}</Context.Provider>
  );
}
export function useNotifications() {
  return useContext(Context);
}
