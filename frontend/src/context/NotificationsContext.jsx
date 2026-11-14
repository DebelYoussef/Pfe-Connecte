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
  const load = useCallback(
    () => service.listNotifications().then((data) => setItems(data.items)),
    [service],
  );
  useEffect(() => {
    load();
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
      markRead,
      markAll,
      refresh: load,
    }),
    [items, unread, markRead, markAll, load],
  );
  return (
    <Context.Provider value={value}>{children}</Context.Provider>
  );
}
export function useNotifications() {
  return useContext(Context);
}
