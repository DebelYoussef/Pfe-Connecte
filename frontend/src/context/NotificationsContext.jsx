import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { listNotifications, markNotificationRead } from "../services";
const Context = createContext(null);
export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const load = useCallback(
    () => listNotifications().then((data) => setItems(data.items)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const unread = items.filter((item) => !item.read).length;
  const markRead = async (id) => {
    await markNotificationRead(id);
    setItems(
      items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  };
  const markAll = async () => {
    await Promise.all(
      items
        .filter((item) => !item.read)
        .map((item) => markNotificationRead(item.id)),
    );
    setItems(items.map((item) => ({ ...item, read: true })));
  };
  return (
    <Context.Provider
      value={{
        items,
        unread,
        unreadCount: unread,
        markRead,
        markAll,
        refresh: load,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useNotifications() {
  return useContext(Context);
}
