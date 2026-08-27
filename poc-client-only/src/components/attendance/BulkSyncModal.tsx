import { useEffect, useState } from "react";
import type { Staff } from "../../types";
import { Modal } from "../common/Modal";
import { useSession } from "../../context/SessionContext";
import {
  applyBulkCalendarSync,
  applyCalendarSyncForStaffOnDate,
  getActiveStaffNamesForAdmin,
  type BulkSyncResult,
} from "../../api";
import { invalidateAttendanceCaches } from "./cacheUtil";
import { todayStr } from "./dateUtils";

interface BulkSyncModalProps {
  onClose: () => void;
  onCompleted: () => void;
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

export function BulkSyncModal({ onClose, onCompleted }: BulkSyncModalProps) {
  const { session } = useSession();
  const [staffOptions, setStaffOptions] = useState<Staff[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BulkSyncResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const staff = getActiveStaffNamesForAdmin(session);
    setStaffOptions(staff);
    setSelectedStaffIds(staff.map((s) => s.id));
  }, [session]);

  if (!session) return null;

  const toggleStaff = (id: string) => {
    setSelectedStaffIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelectedStaffIds((prev) => (prev.length === staffOptions.length ? [] : staffOptions.map((s) => s.id)));
  };

  const runFullSync = async () => {
    setError(null);
    if (selectedStaffIds.length === 0) {
      setError("対象スタッフを1人以上選択してください");
      return;
    }
    if (startDate > endDate) {
      setError("開始日は終了日以前にしてください");
      return;
    }
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: selectedStaffIds.length });
    const collected: BulkSyncResult[] = [];
    for (let i = 0; i < selectedStaffIds.length; i++) {
      try {
        const r = applyBulkCalendarSync(session, startDate, endDate, [selectedStaffIds[i]]);
        collected.push(...r);
      } catch (e) {
        setError((e as Error).message);
      }
      setProgress({ done: i + 1, total: selectedStaffIds.length });
      // eslint-disable-next-line no-await-in-loop
      await yieldFrame();
    }
    setResults(collected);
    setRunning(false);
    invalidateAttendanceCaches();
    onCompleted();
  };

  const retryFailed = async () => {
    if (!results) return;
    const failed = results.filter((r) => !r.success);
    if (failed.length === 0) return;
    setRunning(true);
    setProgress({ done: 0, total: failed.length });
    const updated = [...results];
    for (let i = 0; i < failed.length; i++) {
      const f = failed[i];
      const idx = updated.findIndex((r) => r.staffId === f.staffId && r.date === f.date);
      try {
        const preview = applyCalendarSyncForStaffOnDate(session, f.date, f.staffId);
        if (idx >= 0) updated[idx] = { staffId: f.staffId, date: f.date, success: true, diffCount: preview.diffs.length };
      } catch (e) {
        if (idx >= 0) updated[idx] = { ...updated[idx], success: false, error: (e as Error).message };
      }
      setProgress({ done: i + 1, total: failed.length });
      // eslint-disable-next-line no-await-in-loop
      await yieldFrame();
    }
    setResults(updated);
    setRunning(false);
    invalidateAttendanceCaches();
    onCompleted();
  };

  const succeeded = results?.filter((r) => r.success).length ?? 0;
  const failedCount = results ? results.length - succeeded : 0;
  const totalDiffs = results?.reduce((a, r) => a + r.diffCount, 0) ?? 0;

  return (
    <Modal title="一括反映(管理者用)" onClose={running ? null : onClose}>
      <div className="stack">
        <p className="muted small">指定期間・対象スタッフの全組み合わせにカレンダーの内容を反映します。</p>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="bulk-start">
              開始日
            </label>
            <input
              id="bulk-start"
              className="field-input"
              type="date"
              value={startDate}
              disabled={running}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="bulk-end">
              終了日
            </label>
            <input
              id="bulk-end"
              className="field-input"
              type="date"
              value={endDate}
              disabled={running}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="row between">
          <span className="field-label" style={{ margin: 0 }}>
            対象スタッフ
          </span>
          <button className="app-btn secondary small" onClick={toggleAll} disabled={running}>
            全選択/全解除
          </button>
        </div>
        <div className="stack att-staff-checklist">
          {staffOptions.map((s) => (
            <label key={s.id} className="row att-staff-check-row">
              <input
                type="checkbox"
                checked={selectedStaffIds.includes(s.id)}
                disabled={running}
                onChange={() => toggleStaff(s.id)}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>

        {error && <p className="small" style={{ color: "var(--color-danger)" }}>{error}</p>}

        {running && (
          <div className="stack">
            <div className="att-progress-track">
              <div
                className="att-progress-fill"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="muted small">
              処理中... {progress.done}/{progress.total}
            </p>
          </div>
        )}

        {!running && results && (
          <div className="app-card stack">
            <p className="small">
              成功 {succeeded}件 / 失敗 {failedCount}件 / 反映差分合計 {totalDiffs}件
            </p>
            {failedCount > 0 && (
              <div className="stack att-fail-list">
                {results
                  .filter((r) => !r.success)
                  .map((r, idx) => (
                    <p key={idx} className="small muted">
                      {r.staffId} / {r.date}: {r.error ?? "失敗"}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="row between">
          <button className="app-btn secondary" onClick={onClose} disabled={running}>
            閉じる
          </button>
          {results && failedCount > 0 && !running && (
            <button className="app-btn secondary" onClick={retryFailed}>
              失敗分のみ再実行
            </button>
          )}
          <button className="app-btn" onClick={runFullSync} disabled={running}>
            {running ? "実行中..." : "実行"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
