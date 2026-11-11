import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  FileText,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useNotifications } from "../../context/NotificationsContext";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import Toast from "../../components/ui/Toast";
import { useNavigate } from "react-router-dom";
const icons = {
  APPLICATION_STATUS: BriefcaseBusiness,
  CONVENTION: FileText,
  SUPERVISION: UsersRound,
  JOURNAL: BookOpen,
  REPORT: FileText,
  REMINDER: Bell,
};
const routes = {
  APPLICATION: "/student/candidatures",
  CONVENTION: "/student/convention",
  SUPERVISION: "/student/encadrant",
  JOURNAL: "/student/journal",
  REPORT: "/student/rapport",
  PROFILE: "/student/profil",
};
export default function Notifications() {
  const { items, unreadCount, markRead, markAll } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const navigate = useNavigate();
  const visible =
    filter === "unread" ? items.filter((item) => !item.read) : items;
  async function all() {
    await markAll();
    setToast("Toutes les notifications sont lues");
  }
  return (
    <section className="student-page">
      <PageHeader
        eyebrow="Boîte de réception"
        title="Notifications"
        action={
          <button
            className="outlined-action interactive"
            disabled={!unreadCount}
            onClick={all}
          >
            <CheckCheck size={14} />
            Tout marquer comme lu
          </button>
        }
      />
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
      {visible.length ? (
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
                onClick={() => {
                  markRead(item.id);
                  navigate(routes[item.refType] || "/student");
                }}
              >
                <span className="notification-type-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <small>il y a 2 h</small>
                </div>
                {!item.read ? (
                  <button
                    className="outlined-action row-read interactive"
                    onClick={(event) => {
                      event.stopPropagation();
                      markRead(item.id);
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
      ) : (
        <EmptyState
          title={filter === "unread" ? "Tout est lu" : "Aucune notification"}
          message="Votre boîte de réception est vide."
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
