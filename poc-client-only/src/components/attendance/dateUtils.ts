// 勤怠タブ専用の日付ユーティリティ。scheduleGen.ts の toDateStr と互換の文字列表現(YYYY-MM-DD)を使う。

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateStr(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

export function addDays(dateStr: string, delta: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

/** 指定日を含む週の月曜日を返す。 */
export function mondayOf(dateStr: string): string {
  const d = parseDateStr(dateStr);
  const day = d.getDay(); // 0=日,1=月,...,6=土
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

export function formatJpDate(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_JP[d.getDay()]})`;
}

export function formatJpDateLong(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_JP[d.getDay()]})`;
}

export function formatWeekLabel(weekStart: string): string {
  const dates = weekDates(weekStart);
  const s = parseDateStr(dates[0]);
  const e = parseDateStr(dates[6]);
  const sameMonth = s.getMonth() === e.getMonth();
  const startLabel = `${s.getMonth() + 1}/${s.getDate()}`;
  const endLabel = sameMonth ? `${e.getDate()}` : `${e.getMonth() + 1}/${e.getDate()}`;
  return `${startLabel} 〜 ${endLabel}`;
}

export function isSameMonthAsToday(dateStr: string, today = new Date()): boolean {
  const d = parseDateStr(dateStr);
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}時間${m > 0 ? `${m}分` : ""}`;
}
