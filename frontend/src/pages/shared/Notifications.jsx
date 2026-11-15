import {
  BriefcaseBusiness,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  FileText,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useNotifications } from "../../context/NotificationsContext";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import Tooltip from "../../components/ui/Tooltip";

const icons = {
  APPLICATION: BriefcaseBusiness,
  APPLICATION_STATUS: BriefcaseBusiness,
  CONVENTION: FileText,
  SUPERVISION: UsersRound,
  JOURNAL: BookOpen,
  REPORT: FileText,
  OFFER: BriefcaseBusiness,
  REMINDER: Bell,
};

function destinationFor(notificationRouteMap, item, homePath) {
  const destination = notificationRouteMap?.[item.refType];
  if (!destination) return homePath;
  return destination.replace("{refId}", encodeURIComponent(item.refId || ""));
}

function createdLabel(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function Notifications() {
  const {
    items,
    unreadCount,
    markRead,
    markAll,
    loading,
    error,
    refresh,
  } = useNotifications();
  const { notificationRouteMap, homePath = "/student" } =
    useOutletContext() || {};
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const visible = filter === "unread" ? items.filter((item) => !item.read) : items;

  async function markAllRead() {
    setBusy(true);
    try {
      await markAll();
      setToast("Toutes les notifications sont lues.");
    } catch {
      setToast("Les notifications n’ont pas pu être mises à jour.");
    } finally {
      setBusy(false);
    }
  }

  function openNotification(item) {
    if (!item.read) {
      void markRead(item.id).catch(() =>
        setToast("Cette notification n’a pas pu être marquée comme lue."),
      );
    }
    navigate(destinationFor(notificationRouteMap, item, homePath));
  }

  return (
    <section className="student-page">
      <PageHeader
        eyebrow="Boîte de réception"
        title="Notifications"
        action={
          <Tooltip
            content={
              unreadCount
                ? "Marquer toutes les notifications comme lues"
                : "Aucune notification non lue"
            }
          >
            <button
              type="button"
              className="outlined-action interactive"
              disabled={!unreadCount || busy}
              title={
                unreadCount
                  ? "Marquer toutes les notifications comme lues"
                  : "Aucune notification non lue"
              }
              onClick={markAllRead}
            >
              <CheckCheck size={14} />
              Tout marquer comme lu
            </button>
          </Tooltip>
        }
      />
      {error && (
        <ErrorBanner
          title="Impossible de charger les notifications"
          message={error.message || "Réessayez dans un instant."}
          onRetry={() => void refresh()}
        />
      )}
      <div className="notification-tabs">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Toutes ({items.length})
        </button>
        <button
          className={filter === "unread" ? "active" : ""}
          onClick={() => setFilter("unread")}
        >
          Non lues ({unreadCount})
        </button>
      </div>
      {loading && !error ? (
        <div className="notifications-page-list" aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="notification-row-skeleton" />
          ))}
        </div>
      ) : !error && visible.length ? (
        <div className="notifications-page-list">
          {visible.map((item) => {
            const Icon = icons[item.type] || Bell;
            return (
              <article
                className={
                  item.read
                    ? "notification-page-row interactive"
                    : "notification-page-row unread interactive"
                }
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => openNotification(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openNotification(item);
                  }
                }}
              >
                <span className="notification-type-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <small>{createdLabel(item.createdAt)}</small>
                </div>
                {!item.read ? (
                  <button
                    className="outlined-action row-read interactive"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void markRead(item.id).catch(() =>
                        setToast(
                          "Cette notification n’a pas pu être marquée comme lue.",
                        ),
                      );
                    }}
                  >
                    <Check size={13} />
                    Marquer comme lu
                  </button>
                ) : (
                  <span className="read-label">Lu</span>
                )}
              </article>
            );
          })}
        </div>
      ) : !error ? (
        <EmptyState
          title={filter === "unread" ? "Tout est lu" : "Aucune notification"}
          message="Votre boîte de réception est vide."
          actionLabel="Retour à l’accueil"
          actionTo={homePath}
        />
      ) : null}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
