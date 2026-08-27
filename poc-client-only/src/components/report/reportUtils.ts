// 日報/事故報告モーダル共通のちいさなユーティリティ関数群。

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

export function todayStr(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysStr(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

export function formatDateJP(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const wd = WEEKDAY_JP[d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${wd})`;
}

/** 06:00〜21:00 の間、15分刻みの時刻文字列一覧を返す。 */
export function buildTimeOptions(startHour = 6, endHour = 21): string[] {
  const opts: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === endHour && m > 0) break;
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
}

/** "HH:mm" + 分 を計算し、範囲内(min/maxとも "HH:mm")にクランプする。 */
export function addMinutesClamped(time: string, minutesToAdd: number, min: string, max: string): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutesToAdd;
  const [minH, minM] = min.split(":").map(Number);
  const [maxH, maxM] = max.split(":").map(Number);
  const minTotal = minH * 60 + minM;
  const maxTotal = maxH * 60 + maxM;
  const clamped = Math.min(Math.max(total, minTotal), maxTotal);
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** dob("YYYY-MM-DD")から基準日時点の満年齢を計算する。 */
export function calcAge(dob: string, atDateStr: string): number | null {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  const at = new Date(`${atDateStr}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = at.getFullYear() - birth.getFullYear();
  const monthDiff = at.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birth.getDate())) age--;
  return age;
}

export function toIsoDateTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}
