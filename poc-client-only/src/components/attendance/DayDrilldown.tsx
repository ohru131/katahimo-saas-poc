import { useEffect, useState } from "react";
import type { AttendanceCalcResult, AttendanceRow, SlotKey } from "../../types";
import type { CalendarDiffEntry } from "../../domain/calendarSync";
import { computeAttendanceRow } from "../../domain/attendanceCalc";
import { useSession } from "../../context/SessionContext";
import {
  getPastScheduleForDate,
  previewCalendarSyncForStaffOnDate,
  syncPastScheduleFromCalendar,
} from "../../api";
import { Modal } from "../common/Modal";
import { Timeline, type TimelineBlock } from "./Timeline";
import { DistancePanel } from "./DistancePanel";
import { CalendarSyncModal } from "./CalendarSyncModal";
import type { SlotEditHint } from "./SlotEditModal";
import { formatHm, formatJpDateLong, isSameMonthAsToday } from "./dateUtils";
import { useToast } from "./useToast";

const SLOT_LABELS: Record<SlotKey, string> = {
  slot1: "訪問1",
  slot2: "訪問2",
  slot3: "訪問3",
  office1: "事務作業1",
  office2: "事務作業2",
};

interface DayDrilldownProps {
  staffId: string;
  date: string;
  reloadKey: number;
  onBack: () => void;
  onEditSlot: (date: string, slotKey: SlotKey, hint: SlotEditHint) => void;
  onDataChanged: () => void;
}

function slotToBlock(row: AttendanceRow, key: SlotKey): TimelineBlock | null {
  const group = row[key];
  const name = "customerName" in group ? group.customerName : group.name;
  if (!name || !group.startTime || !group.endTime) return null;
  return {
    slotKey: key,
    title: `${SLOT_LABELS[key]}: ${name}${"customerName" in group ? "様" : ""}`,
    eventType: key.startsWith("office") ? "OFFICE_WORK" : "CUSTOMER_APPOINTMENT",
    start: group.startTime,
    end: group.endTime,
  };
}

function blocksFromRow(row: AttendanceRow): TimelineBlock[] {
  const keys: SlotKey[] = ["slot1", "slot2", "slot3", "office1", "office2"];
  return keys
    .map((k) => slotToBlock(row, k))
    .filter((b): b is TimelineBlock => b !== null)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function DayDrilldown({ staffId, date, reloadKey, onBack, onEditSlot, onDataChanged }: DayDrilldownProps) {
  const { session } = useSession();
  const [row, setRow] = useState<AttendanceRow | null>(null);
  const [calc, setCalc] = useState<AttendanceCalcResult | null>(null);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [syncDiffs, setSyncDiffs] = useState<CalendarDiffEntry[] | null>(null);
  const { toastMessage, showToast } = useToast();

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    try {
      const result = getPastScheduleForDate(session, date, staffId);
      setRow(result.row);
      setCalc(result.calc);
      setEditable(result.editable);
    } finally {
      setLoading(false);
    }
  }, [session, date, staffId, reloadKey]);

  if (!session) return null;

  const refetch = () => {
    const result = getPastScheduleForDate(session, date, staffId);
    setRow(result.row);
    setCalc(result.calc);
    setEditable(result.editable);
  };

  const handleCalendarFetch = () => {
    try {
      const preview = previewCalendarSyncForStaffOnDate(session, date, staffId);
      if (preview.diffs.length === 0) {
        showToast("変更なし");
      } else {
        setSyncDiffs(preview.diffs);
      }
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  const handleRefreshFromSheet = () => {
    const newRow = syncPastScheduleFromCalendar(session, date, staffId);
    setRow(newRow);
    setCalc(computeAttendanceRow(newRow));
    setEditable(isSameMonthAsToday(date));
    showToast("読み込みました");
  };

  const openSlotFromMenu = (slotKey: SlotKey) => {
    if (!row) return;
    const group = row[slotKey];
    const name = "customerName" in group ? group.customerName : group.name;
    setEditMenuOpen(false);
    onEditSlot(date, slotKey, {
      title: name || SLOT_LABELS[slotKey],
      start: group.startTime ?? "",
      end: group.endTime ?? "",
    });
  };

  const blocks = row ? blocksFromRow(row) : [];

  return (
    <div className="stack att-day-drilldown">
      <button className="app-btn secondary" onClick={onBack}>
        ← 週間表示に戻る
      </button>

      <h3 className="att-panel-title">{formatJpDateLong(date)}</h3>

      <div className="row att-day-actions">
        <button className="app-btn secondary small" onClick={handleCalendarFetch} disabled={loading}>
          📅 カレンダーから取得
        </button>
        <button className="app-btn secondary small" onClick={handleRefreshFromSheet} disabled={loading}>
          🔄 勤怠シートから読込
        </button>
        <button className="app-btn secondary small" onClick={() => setEditMenuOpen(true)} disabled={loading}>
          ✏️ 勤怠を編集
        </button>
      </div>

      {toastMessage && <div className="att-toast">{toastMessage}</div>}

      {loading && <p className="muted small">読み込み中...</p>}

      {!loading && row && calc && (
        <>
          {blocks.length === 0 ? (
            <p className="muted small">この日の記録はありません。</p>
          ) : (
            <Timeline blocks={blocks} onSelect={(slotKey) => openSlotFromMenu(slotKey)} />
          )}

          <div className="app-card stack">
            <h3 className="att-panel-title">記録一覧</h3>
            {blocks.length === 0 ? (
              <p className="muted small">記録がありません。</p>
            ) : (
              <div className="stack">
                {blocks.map((b) => (
                  <button key={b.slotKey} className="att-record-row" onClick={() => openSlotFromMenu(b.slotKey)}>
                    <span>{b.title}</span>
                    <span className="muted small">
                      {b.start}〜{b.end}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="att-summary-grid">
              <span>労働時間</span>
              <span>{formatHm(calc.coreMinutes)}</span>
              <span>残業時間</span>
              <span>{formatHm(calc.overtimeMinutes)}</span>
              <span>移動時間合計</span>
              <span>{formatHm(calc.totalMoveMinutes)}</span>
              <span>距離合計</span>
              <span>{calc.totalDistanceKm.toFixed(1)}km</span>
              <span>基準距離超過回数</span>
              <span>{calc.overDistanceCount}</span>
              <span>訪問等回数</span>
              <span>{calc.visitCount}</span>
            </div>
          </div>

          <DistancePanel
            date={date}
            staffId={staffId}
            row={row}
            calc={calc}
            editable={editable}
            onSaved={() => {
              refetch();
              onDataChanged();
            }}
          />
        </>
      )}

      {editMenuOpen && row && (
        <Modal title="勤怠を編集" onClose={() => setEditMenuOpen(false)}>
          <div className="stack">
            {(["slot1", "slot2", "slot3", "office1", "office2"] as SlotKey[]).map((key) => {
              const group = row[key];
              const name = "customerName" in group ? group.customerName : group.name;
              return (
                <button key={key} className="att-record-row" onClick={() => openSlotFromMenu(key)}>
                  <span>{SLOT_LABELS[key]}</span>
                  <span className="muted small">
                    {name ? `${name} ${group.startTime ?? ""}〜${group.endTime ?? ""}` : "(空き)"}
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {syncDiffs && (
        <CalendarSyncModal
          date={date}
          staffId={staffId}
          diffs={syncDiffs}
          onClose={() => setSyncDiffs(null)}
          onApplied={(count) => {
            showToast(`${count}件反映しました`);
            refetch();
            onDataChanged();
          }}
        />
      )}
    </div>
  );
}
