import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CheckCheck,
  FileText,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";
const iconFor = {
  APPLICATION_STATUS: BriefcaseBusiness,
  CONVENTION: FileText,
  SUPERVISION: UsersRound,
  JOURNAL: BookOpen,
  REPORT: FileText,
  REMINDER: Bell,
};
const routeFor = {
  APPLICATION: "/student/candidatures",
  CONVENTION: "/student/convention",
  SUPERVISION: "/student/encadrant",
  JOURNAL: "/student/journal",
  REPORT: "/student/rapport",
  PROFILE: "/student/profil",
};
export default function NotificationBell() {
  const { items, unread, markRead, markAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div className="notification-bell-wrap" ref={ref}>
      <button
        className="icon-button interactive"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="notification-count">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover-head">
            <strong>Notifications</strong>
            <button
              className="outlined-action interactive"
              disabled={!unread}
              onClick={markAll}
            >
              <CheckCheck size={14} />
              Tout marquer comme lu
            </button>
          </div>
          <div className="notification-popover-list">
            {items.slice(0, 5).map((item) => {
              const Icon = iconFor[item.type] || Bell;
              return (
                <button
                  className="notification-popover-row"
                  key={item.id}
                  onClick={() => {
                    markRead(item.id);
                    setOpen(false);
                    navigate(routeFor[item.refType] || "/student");
                  }}
                >
                  <span className="notification-type-icon">
                    <Icon size={15} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                    <em>il y a 2 h</em>
                  </span>
                  {!item.read && <i />}
                </button>
              );
            })}
            {!items.length && (
              <p className="empty-state">Aucune notification</p>
            )}
          </div>
          <Link to="/student/notifications" onClick={() => setOpen(false)}>
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  );
}
