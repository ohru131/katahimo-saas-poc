import type { AttendanceRow, SlotKey } from "../../types";

/** 出勤簿1日分から、開始時刻が最も早い(かつ内容がある)スロットのキーを返す。無ければnull。 */
export function firstSlotKeyOfRow(row: AttendanceRow): SlotKey | null {
  const all: Array<{ key: SlotKey; start: string | null; hasData: boolean }> = [
    { key: "slot1", start: row.slot1.startTime, hasData: Boolean(row.slot1.customerName) },
    { key: "slot2", start: row.slot2.startTime, hasData: Boolean(row.slot2.customerName) },
    { key: "slot3", start: row.slot3.startTime, hasData: Boolean(row.slot3.customerName) },
    { key: "office1", start: row.office1.startTime, hasData: Boolean(row.office1.name) },
    { key: "office2", start: row.office2.startTime, hasData: Boolean(row.office2.name) },
  ];
  const candidates = all.filter((c) => c.hasData && c.start);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  return candidates[0].key;
}
