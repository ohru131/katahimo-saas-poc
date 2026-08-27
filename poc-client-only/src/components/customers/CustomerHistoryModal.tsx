import { useMemo, useState } from "react";
import type { AccidentReport, Customer, Report } from "../../types";
import { getCustomerReports, type TimelineEntry } from "../../api";
import { PSI_RATING_HINT, ES_RATING_HINT } from "../../data/promptDefaults";
import { Modal } from "../common/Modal";
import "./CustomersTab.css";

interface Props {
  customer: Customer;
  onClose: () => void;
}

const PAGE_SIZE = 5;

type ReportView = "original" | "internal" | "customer";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

interface ReportEntryProps {
  report: Report;
  view: ReportView;
  onChangeView: (view: ReportView) => void;
}

function ReportEntry({ report, view, onChangeView }: ReportEntryProps) {
  const text =
    view === "original" ? report.InputText : view === "internal" ? report.InternalReport : report.CustomerReport;

  return (
    <div className="app-card history-entry">
      <div className="row between">
        <span className="muted small">{formatTimestamp(report.Timestamp)}</span>
        <span className="badge">日報</span>
      </div>
      {(report.RiskRating > 0 || report.EsRating > 0) && (
        <div className="row history-ratings">
          {report.RiskRating > 0 && (
            <span className="badge rating-badge" title={PSI_RATING_HINT[report.RiskRating]}>
              PSI {report.RiskRating}: {PSI_RATING_HINT[report.RiskRating]}
            </span>
          )}
          {report.EsRating > 0 && (
            <span className="badge rating-badge" title={ES_RATING_HINT[report.EsRating]}>
              ES {report.EsRating}: {ES_RATING_HINT[report.EsRating]}
            </span>
          )}
        </div>
      )}
      <div className="row history-tabs">
        <button
          className={`app-btn ${view === "original" ? "" : "secondary"}`}
          onClick={() => onChangeView("original")}
        >
          原本
        </button>
        <button
          className={`app-btn ${view === "internal" ? "" : "secondary"}`}
          onClick={() => onChangeView("internal")}
        >
          社内向け
        </button>
        <button
          className={`app-btn ${view === "customer" ? "" : "secondary"}`}
          onClick={() => onChangeView("customer")}
        >
          保護者向け
        </button>
      </div>
      <p className="history-text">{text || "(内容なし)"}</p>
    </div>
  );
}

function AccidentEntry({ accident }: { accident: AccidentReport }) {
  return (
    <div className="app-card history-entry">
      <div className="row between">
        <span className="muted small">{formatTimestamp(accident.Timestamp)}</span>
        <span className="badge">{accident.ReportType}</span>
      </div>
      <div className="stack small">
        <div>発生時刻: {accident.OccurrenceTime || "―"}</div>
        <div>場所: {accident.Location || "―"}</div>
        <div>内容: {accident.AccidentContent || "―"}</div>
      </div>
      <div>
        <div className="field-label">原本</div>
        <p className="history-text">{accident.OriginalInput || "(内容なし)"}</p>
      </div>
    </div>
  );
}

export function CustomerHistoryModal({ customer, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [viewByEntry, setViewByEntry] = useState<Record<string, ReportView>>({});

  const { entries, total } = useMemo(
    () => getCustomerReports(customer.id, page, PAGE_SIZE),
    [customer.id, page],
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderEntry = (entry: TimelineEntry) => {
    if (entry.kind === "report" && entry.report) {
      const id = entry.report.id;
      return (
        <ReportEntry
          key={id}
          report={entry.report}
          view={viewByEntry[id] ?? "original"}
          onChangeView={(v) => setViewByEntry((s) => ({ ...s, [id]: v }))}
        />
      );
    }
    if (entry.kind === "accident" && entry.accident) {
      return <AccidentEntry key={entry.accident.id} accident={entry.accident} />;
    }
    return null;
  };

  return (
    <Modal title={`${customer.name} の活動記録`} onClose={onClose}>
      <div className="stack">
        {entries.length === 0 ? (
          <p className="muted">活動記録はまだありません</p>
        ) : (
          <div className="stack">{entries.map((entry) => renderEntry(entry))}</div>
        )}

        {total > PAGE_SIZE && (
          <div className="row between history-pagination">
            <button className="app-btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← 前へ
            </button>
            <span className="muted small">
              {page} / {totalPages}
            </span>
            <button
              className="app-btn secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              次へ →
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
