import { Download, FileText } from "lucide-react";
import ReportDecisionRow from "./ReportDecisionRow";
import StatusBadge from "../ui/StatusBadge";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ReportVersionCard({
  report,
  downloadUrl,
  actions,
  showRule = true,
}) {
  const hash = report.sha256 || report.pdfSha256 || "";
  return (
    <article className="teacher-detail-card teacher-report-card">
      <header>
        <div>
          <div className="teacher-report-title">
            <FileText size={18} />
            <h2>Version {report.version}</h2>
          </div>
          <p>Déposée le {formatDate(report.submittedAt)}</p>
        </div>
        <StatusBadge status={report.status} />
      </header>
      <p className="teacher-report-hash">
        SHA-256 <code>{hash.slice(0, 16)}</code>
      </p>
      <div className="teacher-report-decisions">
        <ReportDecisionRow
          label="Entreprise"
          decision={report.companyDecision}
          comment={report.companyComment}
        />
        <ReportDecisionRow
          label="Encadrant"
          decision={report.teacherDecision}
          comment={report.teacherComment}
        />
      </div>
      {showRule && (
        <div className="teacher-report-rule">
          Le rapport est validé uniquement si l’entreprise et l’encadrant
          l’approuvent. Chaque nouveau dépôt remet les deux avis à zéro.
        </div>
      )}
      {(downloadUrl || actions) && (
        <footer className="teacher-report-footer">
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="teacher-report-download"
            >
              <Download size={15} />
              Télécharger
            </a>
          )}
          {actions}
        </footer>
      )}
    </article>
  );
}
