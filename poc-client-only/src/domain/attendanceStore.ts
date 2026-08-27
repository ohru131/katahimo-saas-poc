// 出勤簿(勤怠)行の永続化。手入力・カレンダー反映で上書きされた行(override)は
// localStorageに保持し、無ければダミー生成のデフォルト値を「現在の値」として返す。
// 勤怠に書き込む系の処理は常にこの実効値を計算し直し、キャッシュしない(仕様5-5)。

import type { AttendanceRow, Customer, Staff, WeeklyScheduleEvent } from "../types";
import { generateDaySchedule } from "./scheduleGen";
import { loadJSON, saveJSON, removeKey } from "../data/store";

function overrideKey(staffId: string, date: string): string {
  return `attendance:override:${staffId}:${date}`;
}

export function getOverrideRow(staffId: string, date: string): AttendanceRow | null {
  return loadJSON<AttendanceRow | null>(overrideKey(staffId, date), null);
}

export function getEffectiveAttendanceRow(staff: Staff, customers: Customer[], date: string): AttendanceRow {
  const override = getOverrideRow(staff.id, date);
  if (override) return override;
  return generateDaySchedule(staff, customers, date).attendanceRow;
}

export function saveAttendanceRow(staffId: string, date: string, row: AttendanceRow): void {
  saveJSON(overrideKey(staffId, date), row);
}

export function deleteAttendanceOverride(staffId: string, date: string): void {
  removeKey(overrideKey(staffId, date));
}

/** 当月内かどうか(手入力編集可否の判定に使用。カレンダー反映には適用しない)。 */
export function isWithinCurrentMonth(date: string, today = new Date()): boolean {
  const d = new Date(`${date}T00:00:00`);
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

const SLOT_LABELS: Record<string, string> = {
  slot1: "訪問1",
  slot2: "訪問2",
  slot3: "訪問3",
  office1: "事務作業1",
  office2: "事務作業2",
};

/** 出勤簿1日分から「週間予定イベント」を導出する(仕様1.10)。始業終業が両方入力されているスロットのみイベント化。 */
export function toWeeklyScheduleEvents(row: AttendanceRow): WeeklyScheduleEvent[] {
  const events: WeeklyScheduleEvent[] = [];
  const visitSlots: Array<["slot1" | "slot2" | "slot3", typeof row.slot1]> = [
    ["slot1", row.slot1],
    ["slot2", row.slot2],
    ["slot3", row.slot3],
  ];
  for (const [key, slot] of visitSlots) {
    if (slot.startTime && slot.endTime && slot.customerName) {
      events.push({
        date: row.date,
        slotKey: key,
        title: `${SLOT_LABELS[key]}: ${slot.customerName}様`,
        eventType: "CUSTOMER_APPOINTMENT",
        start: slot.startTime,
        end: slot.endTime,
      });
    }
  }
  const officeSlots: Array<["office1" | "office2", typeof row.office1]> = [
    ["office1", row.office1],
    ["office2", row.office2],
  ];
  for (const [key, slot] of officeSlots) {
    if (slot.startTime && slot.endTime && slot.name) {
      events.push({
        date: row.date,
        slotKey: key,
        title: `${SLOT_LABELS[key]}: ${slot.name}`,
        eventType: "OFFICE_WORK",
        start: slot.startTime,
        end: slot.endTime,
      });
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}
