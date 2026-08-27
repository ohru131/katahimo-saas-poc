import type { EventType } from "../types";

/**
 * 件名接頭辞で種別判定する(仕様1.4)。
 * `[予約確定]`/`[新規]` → CUSTOMER_APPOINTMENT、`[イベント]` → EVENT、`[事務]` → OFFICE_WORK。
 * 業務ルール10: 訪問扱いの予定でも所要15分ちょうどなら事務作業として扱う。
 */
export function classifyEvent(title: string, startMin: number, endMin: number): EventType {
  let base: EventType;
  if (title.startsWith("[イベント]")) base = "EVENT";
  else if (title.startsWith("[事務]")) base = "OFFICE_WORK";
  else if (title.startsWith("[予約確定]") || title.startsWith("[新規]")) base = "CUSTOMER_APPOINTMENT";
  else base = "CUSTOMER_APPOINTMENT"; // フォールバック

  if (base === "CUSTOMER_APPOINTMENT" && endMin - startMin === 15) {
    return "OFFICE_WORK";
  }
  return base;
}

export function customerNameFromTitle(title: string): string | null {
  const m = /^\[(?:予約確定|新規)\]\s*(.+?)(?:様)?$/.exec(title);
  return m ? m[1] : null;
}
