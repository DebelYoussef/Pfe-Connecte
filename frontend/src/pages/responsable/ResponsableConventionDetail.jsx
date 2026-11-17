import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import { correctConvention, getConvention, signConvention } from "../../services.responsable";
import { getUser } from "../../auth";

export default function ResponsableConventionDetail() {
  const { conventionId } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getConvention(conventionId);
      setItem(result);
      setText(result.renderedText || "");
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [conventionId]);

  async function handleSign() {
    setBusy(true);
    try {
      const updated = await signConvention(conventionId);
      setItem(updated);
      setToast("Convention approuvée.");
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function handleCorrect() {
    setBusy(true);
    try {
      const updated = await correctConvention(conventionId, text);
      setItem(updated);
      setToast("Convention corrigée.");
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusy(false);
    }
  }

  const toSign =
    item?.state === "SIGNED_COMPANY" &&
    item.currentActorId === `RESP#${getUser()?.etab}`;

  return (
    <section className="student-page responsable-page">
      <PageHeader eyebrow="Conventions" title={item?.shortRef || "Convention"} subtitle={item ? `${item.studentName} · ${item.companyName}` : undefined} />
      {error && <ErrorBanner title="Impossible de charger la convention" message={error.message} onRetry={() => void load()} />}
      {loading ? (
        <Skeleton className="responsable-detail-skeleton" />
      ) : item ? (
        <div className="responsable-detail-grid">
          <section className="responsable-detail-card">
            <div className="responsable-detail-heading">
              <h3>Texte de la convention</h3>
              <StatusBadge status={item.state} />
            </div>
            {item.state === "DRAFT" ? (
              <textarea className="responsable-textarea" value={text} onChange={(event) => setText(event.target.value)} />
            ) : (
              <p className="responsable-rendered-text">{item.renderedText}</p>
            )}
            {item.rejectionReason && <p className="responsable-rejection"><strong>Motif du refus :</strong> {item.rejectionReason}</p>}
            {item.state === "DRAFT" && (
              <button type="button" className="hero-button" disabled={busy || !text.trim()} onClick={() => void handleCorrect()}>Enregistrer la correction</button>
            )}
            {toSign && (
              <button type="button" className="hero-button" disabled={busy} onClick={() => void handleSign()}>
                {busy ? "Signature…" : "Approuver la convention"}
              </button>
            )}
          </section>
          <aside className="responsable-detail-card responsable-timeline">
            <h3>Historique</h3>
            {(item.events || []).slice().reverse().map((event, index) => (
              <article key={`${event.timestamp}-${index}`}>
                <strong>{event.type}</strong>
                <small>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.timestamp))}</small>
                {event.reason && <p>{event.reason}</p>}
              </article>
            ))}
          </aside>
        </div>
      ) : null}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
