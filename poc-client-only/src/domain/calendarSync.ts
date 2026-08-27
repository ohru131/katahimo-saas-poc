// カレンダーからの反映(非破壊マージ、仕様3.4.6〜3.4.8)。
// PoCでは「カレンダー」= 予定タブと同じダミー生成ロジック(generateDaySchedule)の結果を用いる。
// 5グループ単位で、カレンダー側に対応する予定があれば無条件上書き。無い場合、出勤簿側の既存入力は
// 「カレンダー由来の他グループと時間帯が重ならない限り」保持する(重なる場合のみクリア)。

import type { AttendanceRow, Customer, Staff, VisitSlotInput, OfficeSlotInput } from "../types";
import { generateDaySchedule } from "./scheduleGen";

type GroupKey = "slot1" | "slot2" | "slot3" | "office1" | "office2";
const GROUP_KEYS: GroupKey[] = ["slot1", "slot2", "slot3", "office1", "office2"];
const GROUP_LABELS: Record<GroupKey, string> = {
  slot1: "訪問1",
  slot2: "訪問2",
  slot3: "訪問3",
  office1: "事務作業1",
  office2: "事務作業2",
};

export interface CalendarDiffEntry {
  group: GroupKey;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface CalendarSyncPreview {
  mergedRow: AttendanceRow;
  diffs: CalendarDiffEntry[];
}

function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart: string | null, aEnd: string | null, bStart: string | null, bEnd: string | null): boolean {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}

function groupHasData(group: VisitSlotInput | OfficeSlotInput): boolean {
  const name = "customerName" in group ? group.customerName : group.name;
  return Boolean(name) && Boolean(group.startTime) && Boolean(group.endTime);
}

function describe(group: VisitSlotInput | OfficeSlotInput): string {
  const name = "customerName" in group ? group.customerName : group.name;
  if (!name || !group.startTime || !group.endTime) return "(空)";
  return `${name} ${group.startTime}〜${group.endTime}`;
}

/** カレンダー(=ダミー生成ロジックの基準値)から見た当日の予定を取得する。 */
export function getCalendarSourceRow(staff: Staff, customers: Customer[], date: string): AttendanceRow {
  return generateDaySchedule(staff, customers, date).attendanceRow;
}

export function computeCalendarSyncPreview(existingRow: AttendanceRow, calendarRow: AttendanceRow): CalendarSyncPreview {
  const merged: AttendanceRow = { ...existingRow };
  const diffs: CalendarDiffEntry[] = [];

  const calendarHasData: Record<GroupKey, boolean> = {
    slot1: groupHasData(calendarRow.slot1),
    slot2: groupHasData(calendarRow.slot2),
    slot3: groupHasData(calendarRow.slot3),
    office1: groupHasData(calendarRow.office1),
    office2: groupHasData(calendarRow.office2),
  };

  for (const key of GROUP_KEYS) {
    const existingGroup = existingRow[key];
    const calendarGroup = calendarRow[key];

    if (calendarHasData[key]) {
      // カレンダー側に対応する予定があれば無条件上書き
      (merged as any)[key] = calendarGroup;
      const oldDesc = describe(existingGroup);
      const newDesc = describe(calendarGroup);
      if (oldDesc !== newDesc) {
        diffs.push({ group: key, label: GROUP_LABELS[key], oldValue: oldDesc, newValue: newDesc });
      }
      continue;
    }

    // カレンダー側に対応する予定が無い場合: 他の「上書きされるグループ」と時間帯が重なるかチェック
    const overlapsWithOverwritten = GROUP_KEYS.some((otherKey) => {
      if (otherKey === key || !calendarHasData[otherKey]) return false;
      const other = calendarRow[otherKey];
      return overlaps(existingGroup.startTime, existingGroup.endTime, other.startTime, other.endTime);
    });

    if (overlapsWithOverwritten && groupHasData(existingGroup)) {
      const blank = "customerName" in existingGroup
        ? { customerName: "", startTime: null, endTime: null }
        : { name: "", startTime: null, endTime: null };
      (merged as any)[key] = blank;
      diffs.push({ group: key, label: GROUP_LABELS[key], oldValue: describe(existingGroup), newValue: "(空・重複のためクリア)" });
    }
    // 重ならなければ既存入力を保持(merged初期値がそのまま既存値なので何もしない)
  }

  return { mergedRow: merged, diffs };
}
