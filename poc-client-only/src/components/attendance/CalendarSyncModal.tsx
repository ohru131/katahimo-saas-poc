import { useState } from "react";
import type { CalendarDiffEntry } from "../../domain/calendarSync";
import { Modal } from "../common/Modal";
import { useSession } from "../../context/SessionContext";
import { applyCalendarSyncForStaffOnDate } from "../../api";
import { invalidateAttendanceCaches } from "./cacheUtil";
import { formatJpDateLong } from "./dateUtils";

interface CalendarSyncModalProps {
  date: string;
  staffId: string;
  diffs: CalendarDiffEntry[];
  onClose: () => void;
  onApplied: (appliedCount: number) => void;
}

export function CalendarSyncModal({ date, staffId, diffs, onClose, onApplied }: CalendarSyncModalProps) {
  const { session } = useSession();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const handleApply = () => {
    setApplying(true);
    setError(null);
    try {
      const result = applyCalendarSyncForStaffOnDate(session, date, staffId);
      invalidateAttendanceCaches();
      onApplied(result.diffs.length);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal title="カレンダーから反映" onClose={applying ? null : onClose}>
      <div className="stack">
        <p className="small">{formatJpDateLong(date)}</p>
        <p className="small">
          カレンダーの内容をこの日の勤怠に反映します。以下の{diffs.length}件が変更されます。
        </p>
        <div className="stack">
          {diffs.map((d, idx) => (
            <div key={idx} className="app-card att-diff-row">
              <div className="badge">{d.label}</div>
              <div className="row between att-diff-values">
                <span className="muted small">{d.oldValue}</span>
                <span className="small">→</span>
                <span className="small">{d.newValue}</span>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="small" style={{ color: "var(--color-danger)" }}>{error}</p>}
        <div className="row between">
          <button className="app-btn secondary" onClick={onClose} disabled={applying}>
            キャンセル
          </button>
          <button className="app-btn" onClick={handleApply} disabled={applying}>
            {applying ? "反映中..." : "取り込む"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
