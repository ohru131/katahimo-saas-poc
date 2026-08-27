// 出勤簿1日分(A〜AO列相当)の数式列計算ロジック。
// 元GAS「AttendanceCalc.js」相当の再現。閲覧・集計のたびに都度計算し、キャッシュしない
// (仕様5-5: 勤怠に書き込む系の処理は常に最新状態で計算し直す)。

import type { AttendanceCalcResult, AttendanceRow } from "../types";

const CORE_START_MIN = 10 * 60; // 10:00
const CORE_END_MIN = 17 * 60; // 17:00
const OVER_DISTANCE_THRESHOLD_KM = 15;
const OVER_DISTANCE_STEP_KM = 5;

function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function fromMinutes(min: number): string {
  const h = Math.floor(((min % 1440) + 1440) % 1440 / 60);
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 所定内(10:00-17:00)/所定外の分数を分割する。mtg特例は呼び出し側でtotal扱いに切り替える。 */
function splitCoreOvertime(startMin: number | null, endMin: number | null, isMtg: boolean): { core: number; overtime: number; total: number } {
  if (startMin == null || endMin == null || endMin <= startMin) {
    return { core: 0, overtime: 0, total: 0 };
  }
  const total = endMin - startMin;
  if (isMtg) {
    return { core: total, overtime: 0, total };
  }
  const core = Math.max(0, Math.min(endMin, CORE_END_MIN) - Math.max(startMin, CORE_START_MIN));
  const overtime = total - core;
  return { core, overtime, total };
}

function weatherAdjust(min: number | null, isSnow: boolean): number | null {
  if (min == null) return null;
  return isSnow ? Math.round(min * 1.3) : min;
}

export function computeAttendanceRow(row: AttendanceRow): AttendanceCalcResult {
  const e = toMinutes(row.slot1.endTime); // E
  const h = row.move1to2Min; // H (raw)
  const m2start = toMinutes(row.slot2.startTime); // M
  const n = toMinutes(row.slot2.endTime); // N
  const q = row.move2to3Min; // Q (raw)
  const v = toMinutes(row.slot3.startTime); // V

  // F,G: 訪問1→2の移動開始/終了時刻(E, E+H)
  const move1to2Start = e != null ? fromMinutes(e) : null; // F
  const gMin = e != null && h != null ? e + h : null;
  const move1to2End = gMin != null ? fromMinutes(gMin) : null; // G

  // J: 天候補正後移動時間(H)
  const move1to2Adjusted = weatherAdjust(h, row.weatherCommute); // J

  // K: 待機時間 max(0, M-G)
  const wait1 = m2start != null && gMin != null ? Math.max(0, m2start - gMin) : null; // K

  // O,P: 訪問2→3の移動開始/終了時刻(N, N+Q)
  const move2to3Start = n != null ? fromMinutes(n) : null; // O
  const pMin = n != null && q != null ? n + q : null;
  const move2to3End = pMin != null ? fromMinutes(pMin) : null; // P

  // S: 天候補正後移動時間(Q)
  const move2to3Adjusted = weatherAdjust(q, row.weatherSlot1to2); // S

  // T: 待機時間 max(0, V-P)
  const wait2 = v != null && pMin != null ? Math.max(0, v - pMin) : null; // T

  // AD,AE: 5時間帯の所定内・所定外合計
  const ranges = [
    splitCoreOvertime(toMinutes(row.slot1.startTime), toMinutes(row.slot1.endTime), false),
    splitCoreOvertime(toMinutes(row.slot2.startTime), toMinutes(row.slot2.endTime), false),
    splitCoreOvertime(toMinutes(row.slot3.startTime), toMinutes(row.slot3.endTime), false),
    splitCoreOvertime(toMinutes(row.office1.startTime), toMinutes(row.office1.endTime), isMtg(row.office1.name)),
    splitCoreOvertime(toMinutes(row.office2.startTime), toMinutes(row.office2.endTime), isMtg(row.office2.name)),
  ];
  const coreMinutes = ranges.reduce((acc, r) => acc + r.core, 0); // AD
  const overtimeMinutes = ranges.reduce((acc, r) => acc + r.overtime, 0); // AE

  // AF: 移動時間合計 = J + S
  const totalMoveMinutes = (move1to2Adjusted ?? 0) + (move2to3Adjusted ?? 0); // AF

  // AK: 距離合計
  const totalDistanceKm =
    (row.distMove1to2 ?? 0) + (row.distMove2to3 ?? 0) + (row.distCommute ?? 0) + (row.distLeaving ?? 0); // AK

  // AL: 基準距離15km超過回数(5km刻み)。各区間ごとに算出して合計。
  const overDistanceCount =
    overDistanceUnits(row.distMove1to2) +
    overDistanceUnits(row.distMove2to3) +
    overDistanceUnits(row.distCommute) +
    overDistanceUnits(row.distLeaving); // AL

  // AM: 訪問等回数
  const visitCount = computeVisitCount(row); // AM

  return {
    move1to2Start,
    move1to2End,
    move1to2Adjusted,
    wait1,
    move2to3Start,
    move2to3End,
    move2to3Adjusted,
    wait2,
    coreMinutes,
    overtimeMinutes,
    totalMoveMinutes,
    totalDistanceKm,
    overDistanceCount,
    visitCount,
  };
}

function isMtg(officeName: string): boolean {
  return officeName.toLowerCase().includes("mtg");
}

function overDistanceUnits(km: number | null): number {
  if (km == null) return 0;
  return Math.floor(Math.max(0, km - OVER_DISTANCE_THRESHOLD_KM) / OVER_DISTANCE_STEP_KM);
}

function computeVisitCount(row: AttendanceRow): number {
  if (row.distMove2to3 != null) return 3; // AHが数値
  if (row.distMove1to2 != null) return 2; // AGが数値
  if (row.distCommute != null || row.distLeaving != null) return 1; // AI/AJのどちらか
  return 0;
}

/**
 * 月合計の基準距離超過回数(AL)は日次値の単純合計ではなく、
 * 月間の距離合計(区分ごと)に対して超過判定式を再適用する(仕様5-11)。
 */
export function computeMonthlyOverDistanceCount(rows: AttendanceRow[]): number {
  const sum = (pick: (r: AttendanceRow) => number | null) =>
    rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0);

  const monthlyMove1to2 = sum((r) => r.distMove1to2);
  const monthlyMove2to3 = sum((r) => r.distMove2to3);
  const monthlyCommute = sum((r) => r.distCommute);
  const monthlyLeaving = sum((r) => r.distLeaving);

  return (
    overDistanceUnits(monthlyMove1to2) +
    overDistanceUnits(monthlyMove2to3) +
    overDistanceUnits(monthlyCommute) +
    overDistanceUnits(monthlyLeaving)
  );
}
