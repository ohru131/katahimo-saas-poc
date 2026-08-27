import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { useSession } from "../../context/SessionContext";
import { getAttendanceMonth, type MonthlySummary } from "../../api";
import { currentYearMonth, formatHm } from "./dateUtils";

interface MonthlySummaryModalProps {
  staffId: string;
  onClose: () => void;
  onSelectDay: (date: string) => void;
}

export function MonthlySummaryModal({ staffId, onClose, onSelectDay }: MonthlySummaryModalProps) {
  const { session } = useSession();
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    try {
      setSummary(getAttendanceMonth(session, yearMonth, staffId));
    } finally {
      setLoading(false);
    }
  }, [session, staffId, yearMonth]);

  if (!session) return null;

  return (
    <Modal title="月次集計" onClose={onClose}>
      <div className="stack">
        <div>
          <label className="field-label" htmlFor="monthly-select">
            対象月
          </label>
          <input
            id="monthly-select"
            className="field-input"
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </div>

        {loading && <p className="muted small">読み込み中...</p>}

        {!loading && summary && summary.days.length === 0 && (
          <p className="muted small">この月の記録はありません。</p>
        )}

        {!loading && summary && summary.days.length > 0 && (
          <div className="stack">
            <div className="att-monthly-table">
              <div className="att-monthly-row att-monthly-head">
                <span>日付</span>
                <span>訪問先等</span>
                <span>労働</span>
                <span>残業</span>
                <span>移動</span>
                <span>距離</span>
                <span>超過</span>
              </div>
              {summary.days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  className="att-monthly-row att-monthly-data-row"
                  onClick={() => {
                    onSelectDay(d.date);
                    onClose();
                  }}
                >
                  <span>{d.date.slice(5)}</span>
                  <span className="att-monthly-dest">{d.destinations}</span>
                  <span>{formatHm(d.coreMinutes)}</span>
                  <span>{formatHm(d.overtimeMinutes)}</span>
                  <span>{formatHm(d.totalMoveMinutes)}</span>
                  <span>{d.totalDistanceKm.toFixed(1)}km</span>
                  <span>{d.overDistanceCount}</span>
                </button>
              ))}
              <div className="att-monthly-row att-monthly-total-row">
                <span>合計</span>
                <span />
                <span>{formatHm(summary.totals.coreMinutes)}</span>
                <span>{formatHm(summary.totals.overtimeMinutes)}</span>
                <span>{formatHm(summary.totals.totalMoveMinutes)}</span>
                <span>{summary.totals.totalDistanceKm.toFixed(1)}km</span>
                <span>{summary.totals.overDistanceCount}</span>
              </div>
            </div>

            <div className="app-card">
              <p className="small">
                領収書合計: {summary.receiptTotal.toLocaleString()}円({summary.receiptCount}件)
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
