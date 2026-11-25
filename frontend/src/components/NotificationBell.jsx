import {
  Bell,
  BookOpen,
  Building2,
  BriefcaseBusiness,
  CheckCheck,
  FileClock,
  FileText,
  Layers,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";
import Toast from "./ui/Toast";
import Tooltip from "./ui/Tooltip";
const iconFor = {
  APPLICATION: BriefcaseBusiness,
  APPLICATION_STATUS: BriefcaseBusiness,
  CONVENTION: FileText,
  SUPERVISION: UsersRound,
  JOURNAL: BookOpen,
  REPORT: FileText,
  OFFER: BriefcaseBusiness,
  REMINDER: Bell,
  INSTITUTION_WITHOUT_RESPONSABLE: Building2,
  DEPARTMENT_WITHOUT_SPECIALTY: Layers,
  CONVENTION_WAITING_NO_RESPONSABLE: FileClock,
  ADMIN_ACCOUNT_CREATED: ShieldAlert,
  ADMIN_ROLE_GRANTED: ShieldAlert,
};
function destinationFor(notificationRouteMap, item, homePath) {
  const destination = notificationRouteMap?.[item.refType];
  if (!destination) return homePath;
  const refId = item.type === "DEPARTMENT_WITHOUT_SPECIALTY"
    ? item.refId?.split("#")[0]
    : item.refId;
  return destination.replace("{refId}", encodeURIComponent(refId || ""));
}

function createdLabel(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function NotificationBell({
  notificationRouteMap,
  notificationsPath = "/student/notifications",
  homePath = "/student",
}) {
  const {
    items,
    unread,
    markRead,
    markAll,
    refresh,
    refreshOnOpen,
    error,
    loading,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [toast, setToast] = useState("");
  const ref = useRef(null);
  const navigate = useNavigate();

  async function markAllRead() {
    setActionError("");
    setMarkingAll(true);
    try {
      await markAll();
    } catch (error) {
      setActionError(error?.message || "Les notifications n’ont pas pu être mises à jour.");
      setToast(error?.message || "Les notifications n’ont pas pu être mises à jour.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function openNotification(item) {
    if (!item.read) {
      try {
        await markRead(item.id);
      } catch (error) {
        setActionError(error?.message || "Cette notification n’a pas pu être marquée comme lue.");
        return;
      }
    }
    setOpen(false);
    navigate(destinationFor(notificationRouteMap, item, homePath));
  }

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
        type="button"
        className="icon-button interactive"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          const willOpen = !open;
          setOpen(willOpen);
          setActionError("");
          if (willOpen && refreshOnOpen) void refresh();
        }}
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
            <Tooltip
              content={
                markingAll
                  ? "Mise à jour des notifications en cours"
                  : unread
                  ? "Marquer toutes les notifications comme lues"
                  : "Aucune notification non lue"
              }
            >
              <button
                type="button"
                className="outlined-action interactive"
                disabled={!unread || markingAll}
                title={
                  markingAll
                    ? "Mise à jour des notifications en cours"
                    : unread
                    ? "Marquer toutes les notifications comme lues"
                    : "Aucune notification non lue"
                }
                onClick={markAllRead}
              >
                <CheckCheck size={14} />
                Tout marquer comme lu
              </button>
            </Tooltip>
          </div>
          <div className="notification-popover-list">
            {items.slice(0, 5).map((item) => {
              const Icon = iconFor[item.type] || Bell;
              return (
                <button
                  className="notification-popover-row"
                  key={item.id}
                  onClick={() => void openNotification(item)}
                >
                  <span className={`notification-type-icon${item.level === "WARNING" ? " warning" : ""}`}>
                    <Icon size={15} />
                  </span>
                  <span>
                    <strong>
                      {item.title}
                      {item.level === "WARNING" && <em className="notification-alert-pill">Alerte</em>}
                    </strong>
                    <small>{item.body}</small>
                    <em>{createdLabel(item.createdAt)}</em>
                  </span>
                  {!item.read && <i />}
                </button>
              );
            })}
            {loading && !items.length && <p className="empty-state">Chargement…</p>}
            {!items.length && (
              !loading && <p className="empty-state">Aucune notification</p>
            )}
          </div>
          {error && (
            <p className="notification-popover-error" role="alert">
              {error.message || "Impossible de charger les notifications."}
              <button type="button" onClick={() => void refresh()}>Réessayer</button>
            </p>
          )}
          {actionError && (
            <p className="notification-popover-error" role="alert">
              {actionError}
            </p>
          )}
          <Link to={notificationsPath} onClick={() => setOpen(false)}>
            Voir toutes les notifications
          </Link>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
