import { useEffect, useState } from "react";
import type { SlotKey, Staff } from "../../types";
import { useSession } from "../../context/SessionContext";
import { useStaffSelection } from "../../context/StaffSelectionContext";
import { getActiveStaffNamesForAdmin, getPastScheduleForDate } from "../../api";
import { WeeklyView } from "./WeeklyView";
import { DayDrilldown } from "./DayDrilldown";
import { SlotEditModal, type SlotEditHint } from "./SlotEditModal";
import { MonthlySummaryModal } from "./MonthlySummaryModal";
import { BulkSyncModal } from "./BulkSyncModal";
import { mondayOf, todayStr } from "./dateUtils";
import { firstSlotKeyOfRow } from "./rowUtils";
import "./AttendanceTab.css";

type ViewMode = "week" | "day";

interface EditingSlotState {
  date: string;
  slotKey: SlotKey;
  hint: SlotEditHint;
}

export function AttendanceTab() {
  const { session } = useSession();
  const { selectedStaffId, setSelectedStaffId } = useStaffSelection();
  const [staffOptions, setStaffOptions] = useState<Staff[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [weekStart, setWeekStart] = useState<string>(mondayOf(todayStr()));
  const [reloadKey, setReloadKey] = useState(0);

  const [editingSlot, setEditingSlot] = useState<EditingSlotState | null>(null);
  const [monthlySummaryOpen, setMonthlySummaryOpen] = useState(false);
  const [bulkSyncOpen, setBulkSyncOpen] = useState(false);

  useEffect(() => {
    if (!session || !session.isAdmin) return;
    setStaffOptions(getActiveStaffNamesForAdmin(session));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (session.isAdmin && !selectedStaffId) {
      setSelectedStaffId(session.staffId);
    }
  }, [session, selectedStaffId, setSelectedStaffId]);

  if (!session) return null;

  const targetStaffId = session.isAdmin ? selectedStaffId || session.staffId : session.staffId;

  const bumpReload = () => setReloadKey((k) => k + 1);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setViewMode("day");
    // 選択日が変わるので、取得中の編集モーダルは自動クローズする
    setEditingSlot(null);
  };

  const handleBackToWeek = () => {
    setWeekStart(mondayOf(selectedDate));
    setViewMode("week");
  };

  const handleChangeWeekStart = (newWeekStart: string) => {
    setWeekStart(newWeekStart);
  };

  const handleEditSlot = (date: string, slotKey: SlotKey, hint: SlotEditHint) => {
    setEditingSlot({ date, slotKey, hint });
  };

  const handleSelectMonthlyDay = (date: string) => {
    const result = getPastScheduleForDate(session, date, targetStaffId);
    const slotKey = firstSlotKeyOfRow(result.row);
    setSelectedDate(date);
    setViewMode("day");
    if (slotKey) {
      const group = result.row[slotKey];
      const name = "customerName" in group ? group.customerName : group.name;
      setEditingSlot({
        date,
        slotKey,
        hint: { title: name || slotKey, start: group.startTime ?? "", end: group.endTime ?? "" },
      });
    } else {
      setEditingSlot(null);
    }
  };

  return (
    <div className="stack att-tab">
      <div className="row att-top-actions">
        <button className="app-btn secondary" onClick={() => setMonthlySummaryOpen(true)}>
          📊 月次集計
        </button>
        {session.isAdmin && (
          <button className="app-btn secondary" onClick={() => setBulkSyncOpen(true)}>
            📅 一括反映(管理者用)
          </button>
        )}
      </div>

      <p className="muted small att-notice">
        ※カレンダーの変更は自動的には勤怠に反映されません。反映するには「カレンダーから取得」または「一括反映」を実行してください。
      </p>

      {session.isAdmin && (
        <div className="stack">
          <label className="field-label" htmlFor="attendance-staff-select">
            対象スタッフ
          </label>
          <select
            id="attendance-staff-select"
            className="field-input"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {viewMode === "week" ? (
        <WeeklyView
          staffId={targetStaffId}
          weekStart={weekStart}
          reloadKey={reloadKey}
          onChangeWeekStart={handleChangeWeekStart}
          onSelectDate={handleSelectDate}
          onEditSlot={handleEditSlot}
        />
      ) : (
        <DayDrilldown
          staffId={targetStaffId}
          date={selectedDate}
          reloadKey={reloadKey}
          onBack={handleBackToWeek}
          onEditSlot={handleEditSlot}
          onDataChanged={bumpReload}
        />
      )}

      {editingSlot && (
        <SlotEditModal
          date={editingSlot.date}
          slotKey={editingSlot.slotKey}
          staffId={targetStaffId}
          hint={editingSlot.hint}
          onClose={() => setEditingSlot(null)}
          onSaved={bumpReload}
        />
      )}

      {monthlySummaryOpen && (
        <MonthlySummaryModal
          staffId={targetStaffId}
          onClose={() => setMonthlySummaryOpen(false)}
          onSelectDay={handleSelectMonthlyDay}
        />
      )}

      {bulkSyncOpen && session.isAdmin && (
        <BulkSyncModal onClose={() => setBulkSyncOpen(false)} onCompleted={bumpReload} />
      )}
    </div>
  );
}
