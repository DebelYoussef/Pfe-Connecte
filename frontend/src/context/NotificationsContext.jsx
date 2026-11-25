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
const PAGE_SIZE = 20;

export function NotificationsProvider({
  children,
  service = studentService,
  autoRefresh = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const load = useCallback(async ({ append = false, cursor } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await service.listNotifications({
          limit: PAGE_SIZE,
          cursor,
        });
        setItems((current) =>
          append
            ? [
                ...current,
                ...data.items.filter(
                  (item) => !current.some((loaded) => loaded.id === item.id),
                ),
              ]
            : data.items,
        );
        setNextCursor(data.nextCursor || null);
        return data;
      } catch (loadError) {
        setError(loadError);
        return null;
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    }, [service]);
  useEffect(() => {
    let active = true;
    const refreshVisible = () => {
      if (active && !document.hidden) {
        void Promise.resolve().then(() => {
          if (active) return load();
          return null;
        });
      }
    };
    void Promise.resolve().then(() => {
      if (active) return load();
      return null;
    });
    if (autoRefresh) {
      const timer = window.setInterval(refreshVisible, 60000);
      window.addEventListener("focus", refreshVisible);
      document.addEventListener("visibilitychange", refreshVisible);
      return () => {
        active = false;
        window.clearInterval(timer);
        window.removeEventListener("focus", refreshVisible);
        document.removeEventListener("visibilitychange", refreshVisible);
      };
    }
    return () => {
      active = false;
    };
  }, [autoRefresh, load]);
  const unread = items.filter((item) => !item.read).length;
  const markRead = useCallback(async (id) => {
    await service.markNotificationRead(id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, [service]);
  const markAll = useCallback(async () => {
    const snapshot = items;
    const unreadItems = snapshot.filter((item) => !item.read);
    if (!unreadItems.length) return;
    if (!autoRefresh) {
      await Promise.all(
        unreadItems.map((item) => service.markNotificationRead(item.id)),
      );
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      return;
    }
    setItems(snapshot.map((item) => ({ ...item, read: true })));
    try {
      /* NEEDS BACKEND (read-all endpoint) */
      for (let index = 0; index < unreadItems.length; index += 4) {
        await Promise.all(
          unreadItems
            .slice(index, index + 4)
            .map((item) => service.markNotificationRead(item.id)),
        );
      }
    } catch (markError) {
      setItems(snapshot);
      throw markError;
    }
  }, [autoRefresh, items, service]);
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return null;
    return load({ append: true, cursor: nextCursor });
  }, [load, loadingMore, nextCursor]);
  const refresh = useCallback(() => load(), [load]);
  const value = useMemo(
    () => ({
      items,
      unread,
      unreadCount: unread,
      loading,
      loadingMore,
      error,
      nextCursor,
      markRead,
      markAll,
      loadMore,
      refresh,
      refreshOnOpen: autoRefresh,
    }),
    [
      items,
      unread,
      loading,
      loadingMore,
      error,
      nextCursor,
      markRead,
      markAll,
      loadMore,
      refresh,
      autoRefresh,
    ],
  );
  return (
    <Context.Provider value={value}>{children}</Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  return useContext(Context);
}
