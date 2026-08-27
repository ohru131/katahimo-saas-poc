// クライアント側で完結するモックバックエンドAPI。
// 元GASの google.script.run 関数(付録D)に対応する関数をここに実装する。
// サーバーは存在しないため、全てブラウザ内のダミーデータストア(localStorage)への読み書きに置き換える。

import type {
  AccidentReport,
  AdminSettings,
  AttendanceRow,
  CustomerListResult,
  LightAppointment,
  Receipt,
  Report,
  RoutedAppointment,
  Session,
  Staff,
  WeeklyScheduleEvent,
} from "../types";
import { getMasterCustomers, getMasterDataVersion, getMasterStaff } from "../data/seed";
import { generateDaySchedule, dateRange, toDateStr } from "../domain/scheduleGen";
import { computeAttendanceRow, computeMonthlyOverDistanceCount } from "../domain/attendanceCalc";
import {
  getEffectiveAttendanceRow,
  isWithinCurrentMonth,
  saveAttendanceRow,
  deleteAttendanceOverride,
  toWeeklyScheduleEvents,
} from "../domain/attendanceStore";
import { computeCalendarSyncPreview, getCalendarSourceRow, type CalendarSyncPreview } from "../domain/calendarSync";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
} from "../domain/routeCalc";
import { generateAccidentReport as genAccident, generateReportWithWarnings as genReport } from "../domain/aiDummy";
import type { AccidentGenInput, ReceiptOcrResult, ReportGenInput } from "../domain/aiDummy";
import { extractAmountFromImage as ocrExtract } from "../domain/aiDummy";
import {
  notifyAccidentSubmitted,
  notifyReceiptRegistered,
  notifyReportSubmitted,
  notifyVisitComplete,
} from "../domain/notifications";
import {
  checkReceiptDuplicate,
  getAllAccidentReports,
  getAllReceipts,
  getAllReports,
  getRecentCustomerIds,
  pushRecentCustomer,
  registerReceiptDuplicateKey,
  saveAccidentRecord,
  saveReceiptRecord,
  saveReportRecord,
} from "../data/records";
import { cacheGet, cacheSet, uid, TTL } from "../data/store";
import {
  AVAILABLE_GEMINI_MODELS,
  getAdminSettings,
  maskApiKey,
  saveAdminSettings,
} from "../data/adminSettings";

// ---------------------------------------------------------------------------
// 権限ヘルパー
// ---------------------------------------------------------------------------

class PermissionError extends Error {}

function resolveTargetStaffId(session: Session, requestedStaffId?: string | null): string {
  if (session.isAdmin && requestedStaffId) return requestedStaffId;
  return session.staffId;
}

function requireAdmin(session: Session): void {
  if (!session.isAdmin) throw new PermissionError("管理者権限が必要です");
}

function findStaff(staffId: string): Staff {
  const staff = getMasterStaff().find((s) => s.id === staffId);
  if (!staff) throw new Error("スタッフが見つかりません");
  return staff;
}

// ---------------------------------------------------------------------------
// 顧客データ
// ---------------------------------------------------------------------------

export function getData(): CustomerListResult {
  const cached = cacheGet<CustomerListResult>("api:customerData");
  if (cached) return cached;

  const customers = getMasterCustomers();
  const cities = Array.from(new Set(customers.map((c) => c.city))).sort();
  const result: CustomerListResult = { cities, customers, version: getMasterDataVersion() };
  cacheSet("api:customerData", result, TTL.CUSTOMER_DB);
  return result;
}

export function checkDataVersion(clientVersion: string): { changed: boolean; version: string } {
  const version = getMasterDataVersion();
  return { changed: clientVersion !== version, version };
}

export function getUiConfig(): { appName: string; version: string } {
  return { appName: "保育日報", version: "Ver. 1.0.1" };
}

// ---------------------------------------------------------------------------
// 予定(スケジュール)
// ---------------------------------------------------------------------------

export function getScheduleForDate(session: Session, date: string, staffId?: string): LightAppointment[] {
  const targetId = resolveTargetStaffId(session, staffId);
  const staff = findStaff(targetId);
  const customers = getMasterCustomers();
  const bundle = generateDaySchedule(staff, customers, date);
  return bundle.events.map((e) => ({
    title: e.title,
    eventType: e.eventType,
    start: e.start,
    end: e.end,
    address: e.address,
  }));
}

export function getRouteForStaffOnDate(
  session: Session,
  date: string,
  staffId?: string,
  forceRefresh = false,
): { appointments: RoutedAppointment[]; fetchedAt: string } {
  const targetId = resolveTargetStaffId(session, staffId);
  const cacheKey = `api:route:${targetId}:${date}`;
  if (!forceRefresh) {
    const cached = cacheGet<{ appointments: RoutedAppointment[]; fetchedAt: string }>(cacheKey);
    if (cached) return cached;
  }

  const staff = findStaff(targetId);
  const customers = getMasterCustomers();
  const bundle = generateDaySchedule(staff, customers, date);

  const customerEvents = bundle.events.filter((e) => e.eventType === "CUSTOMER_APPOINTMENT");
  const appointments: RoutedAppointment[] = bundle.events.map((e) => {
    if (e.eventType !== "CUSTOMER_APPOINTMENT") {
      return {
        eventType: e.eventType,
        customerName: null,
        startTime: e.start,
        endTime: e.end,
        reservaUrl: null,
        customerId: null,
        address: null,
        moveUrl: null,
        moveMin: null,
        moveKm: null,
        attendanceUrl: null,
        attendanceMin: null,
        attendanceKm: null,
        leavingUrl: null,
        leavingMin: null,
        leavingKm: null,
      };
    }
    const visitIdx = customerEvents.indexOf(e);
    const isFirst = visitIdx === 0;
    const isLast = visitIdx === customerEvents.length - 1;
    const prev = visitIdx > 0 ? customerEvents[visitIdx - 1] : null;
    const moveMeta = visitIdx === 1 ? bundle.routeMeta.move1to2 : visitIdx === 2 ? bundle.routeMeta.move2to3 : null;

    return {
      eventType: e.eventType,
      customerName: e.customerName,
      startTime: e.start,
      endTime: e.end,
      reservaUrl: `https://reserva.example.jp/reservations/${e.id}`,
      customerId: e.customerId,
      address: e.address,
      moveUrl: prev && prev.address && e.address ? buildGoogleMapsDirectionsUrl(prev.address, e.address) : null,
      moveMin: moveMeta ? moveMeta.minutes : null,
      moveKm: moveMeta ? moveMeta.km : null,
      attendanceUrl: isFirst && e.address ? buildGoogleMapsDirectionsUrl(staff.address, e.address) : null,
      attendanceMin: isFirst ? bundle.routeMeta.commute?.minutes ?? null : null,
      attendanceKm: isFirst ? bundle.routeMeta.commute?.km ?? null : null,
      leavingUrl: isLast && e.address ? buildGoogleMapsDirectionsUrl(e.address, staff.address) : null,
      leavingMin: isLast ? bundle.routeMeta.leaving?.minutes ?? null : null,
      leavingKm: isLast ? bundle.routeMeta.leaving?.km ?? null : null,
    };
  });

  const result = { appointments, fetchedAt: new Date().toISOString() };
  cacheSet(cacheKey, result, TTL.SCHEDULE_ROUTE);
  return result;
}

export function buildCustomerMapSearchUrl(address: string): string {
  return buildGoogleMapsSearchUrl(address);
}

// ---------------------------------------------------------------------------
// 勤怠(出勤簿)
// ---------------------------------------------------------------------------

export function getPastScheduleForDate(
  session: Session,
  date: string,
  staffId?: string,
): { row: AttendanceRow; calc: ReturnType<typeof computeAttendanceRow>; editable: boolean } {
  const targetId = resolveTargetStaffId(session, staffId);
  const staff = findStaff(targetId);
  const customers = getMasterCustomers();
  const row = getEffectiveAttendanceRow(staff, customers, date);
  return { row, calc: computeAttendanceRow(row), editable: isWithinCurrentMonth(date) };
}

export function updatePastSchedule(session: Session, date: string, row: AttendanceRow, staffId?: string): void {
  const targetId = resolveTargetStaffId(session, staffId);
  if (!isWithinCurrentMonth(date)) {
    throw new Error("当月内の勤怠のみ手入力で編集できます");
  }
  if (!Number.isInteger(row.shoppingProxyCount) || row.shoppingProxyCount < 0) {
    throw new Error("買物代行は0以上の整数で入力してください");
  }
  saveAttendanceRow(targetId, date, { ...row, staffId: targetId, date });
}

export function deletePastScheduleSlot(session: Session, date: string, staffId?: string): void {
  const targetId = resolveTargetStaffId(session, staffId);
  if (!isWithinCurrentMonth(date)) {
    throw new Error("当月内の勤怠のみ編集できます");
  }
  deleteAttendanceOverride(targetId, date);
}

export function previewCalendarSyncForStaffOnDate(session: Session, date: string, staffId?: string): CalendarSyncPreview {
  const targetId = resolveTargetStaffId(session, staffId);
  const staff = findStaff(targetId);
  const customers = getMasterCustomers();
  const existing = getEffectiveAttendanceRow(staff, customers, date);
  const calendarRow = getCalendarSourceRow(staff, customers, date);
  return computeCalendarSyncPreview(existing, calendarRow);
}

export function applyCalendarSyncForStaffOnDate(
  session: Session,
  date: string,
  staffId?: string,
): CalendarSyncPreview {
  const targetId = resolveTargetStaffId(session, staffId);
  const preview = previewCalendarSyncForStaffOnDate(session, date, staffId);
  // カレンダー反映には期限制限が無い(業務ルール1)
  saveAttendanceRow(targetId, date, preview.mergedRow);
  return preview;
}

export function syncPastScheduleFromCalendar(session: Session, date: string, staffId?: string): AttendanceRow {
  // 「🔄 勤怠シートから読込」相当。プレビュー無しで単純に現在の実効値を再取得する
  // (勤怠データはキャッシュしないため常に最新)。
  const targetId = resolveTargetStaffId(session, staffId);
  const staff = findStaff(targetId);
  const customers = getMasterCustomers();
  return getEffectiveAttendanceRow(staff, customers, date);
}

export interface BulkSyncTarget {
  staffId: string;
  date: string;
}

export interface BulkSyncResult {
  staffId: string;
  date: string;
  success: boolean;
  diffCount: number;
  error?: string;
}

export function applyBulkCalendarSync(
  session: Session,
  startDate: string,
  endDate: string,
  staffIds: string[],
): BulkSyncResult[] {
  requireAdmin(session);
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const results: BulkSyncResult[] = [];
  for (const sId of staffIds) {
    for (const d of dates) {
      try {
        const preview = applyCalendarSyncForStaffOnDate(session, d, sId);
        results.push({ staffId: sId, date: d, success: true, diffCount: preview.diffs.length });
      } catch (e) {
        results.push({ staffId: sId, date: d, success: false, diffCount: 0, error: (e as Error).message });
      }
    }
  }
  return results;
}

export function getActiveStaffNamesForAdmin(session: Session): Staff[] {
  if (!session.isAdmin) return [];
  return getMasterStaff().filter((s) => !s.retiredAt);
}

export function getWeeklyScheduleForStaff(
  session: Session,
  weekStartDate: string,
  staffId?: string,
): Record<string, WeeklyScheduleEvent[]> {
  const targetId = resolveTargetStaffId(session, staffId);
  const staff = findStaff(targetId);
  const customers = getMasterCustomers();
  const start = new Date(`${weekStartDate}T00:00:00`);
  const dates = dateRange(start, 0, 6);

  const cacheKey = `api:weekly:${targetId}:${weekStartDate}`;
  const cached = cacheGet<Record<string, WeeklyScheduleEvent[]>>(cacheKey);
  if (cached) return cached;

  const result: Record<string, WeeklyScheduleEvent[]> = {};
  for (const d of dates) {
    const row = getEffectiveAttendanceRow(staff, customers, d);
    result[d] = toWeeklyScheduleEvents(row);
  }
  cacheSet(cacheKey, result, TTL.WEEKLY_SCHEDULE);
  return result;
}

export interface MonthlyDayRow {
  date: string;
  destinations: string;
  coreMinutes: number;
  overtimeMinutes: number;
  totalMoveMinutes: number;
  totalDistanceKm: number;
  overDistanceCount: number;
}

export interface MonthlySummary {
  yearMonth: string;
  days: MonthlyDayRow[];
  totals: {
    coreMinutes: number;
    overtimeMinutes: number;
    totalMoveMinutes: number;
    totalDistanceKm: number;
    overDistanceCount: number; // 月合計のみ特殊計算
  };
  receiptTotal: number;
  receiptCount: number;
}

export function getAttendanceMonth(session: Session, yearMonth: string, staffId?: string): MonthlySummary {
  const targetId = resolveTargetStaffId(session, staffId);
  const cacheKey = `api:monthly:${targetId}:${yearMonth}`;
  const cached = cacheGet<MonthlySummary>(cacheKey);
  if (cached) return cached;

  const staff = findStaff(targetId);
  const customers = getMasterCustomers();
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  const rows: AttendanceRow[] = [];
  const days: MonthlyDayRow[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, "0")}`;
    const row = getEffectiveAttendanceRow(staff, customers, dateStr);
    const hasData = [row.slot1, row.slot2, row.slot3].some((s) => s.customerName) ||
      [row.office1, row.office2].some((s) => s.name);
    if (!hasData) continue; // 記録がある日のみ表示
    rows.push(row);
    const calc = computeAttendanceRow(row);
    const destinations = [row.slot1.customerName, row.slot2.customerName, row.slot3.customerName]
      .filter(Boolean)
      .join("、") || "-";
    days.push({
      date: dateStr,
      destinations,
      coreMinutes: calc.coreMinutes,
      overtimeMinutes: calc.overtimeMinutes,
      totalMoveMinutes: calc.totalMoveMinutes,
      totalDistanceKm: calc.totalDistanceKm,
      overDistanceCount: calc.overDistanceCount,
    });
  }

  const totals = {
    coreMinutes: days.reduce((a, d) => a + d.coreMinutes, 0),
    overtimeMinutes: days.reduce((a, d) => a + d.overtimeMinutes, 0),
    totalMoveMinutes: days.reduce((a, d) => a + d.totalMoveMinutes, 0),
    totalDistanceKm: Math.round(days.reduce((a, d) => a + d.totalDistanceKm, 0) * 10) / 10,
    // 月合計のAL(超過回数)だけは日次値の単純合計ではなく、月間距離合計に式を再適用する
    overDistanceCount: computeMonthlyOverDistanceCount(rows),
  };

  const receipts = getAllReceipts().filter(
    (r) => r.userId === staff.name && r.datetime.slice(0, 7) === yearMonth && !r.duplicateOf,
  );

  const result: MonthlySummary = {
    yearMonth,
    days,
    totals,
    receiptTotal: receipts.reduce((a, r) => a + (r.amount ?? 0), 0),
    receiptCount: receipts.length,
  };
  cacheSet(cacheKey, result, TTL.MONTHLY_SUMMARY);
  return result;
}

// ---------------------------------------------------------------------------
// 日報・事故報告・活動記録
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  kind: "report" | "accident";
  timestamp: string;
  report?: Report;
  accident?: AccidentReport;
}

export function getCustomerReports(customerId: string, page: number, pageSize = 5): { entries: TimelineEntry[]; total: number } {
  const reports = getAllReports().filter((r) => r.CustomerId === customerId);
  const accidents = getAllAccidentReports().filter((a) => a.CustomerId === customerId);
  const entries: TimelineEntry[] = [
    ...reports.map((r) => ({ kind: "report" as const, timestamp: r.Timestamp, report: r })),
    ...accidents.map((a) => ({ kind: "accident" as const, timestamp: a.Timestamp, accident: a })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const start = (page - 1) * pageSize;
  return { entries: entries.slice(start, start + pageSize), total: entries.length };
}

export function generateReportWithWarnings(input: ReportGenInput) {
  return genReport(input);
}

export function generateAccidentReport(input: AccidentGenInput) {
  return genAccident(input);
}

export function saveReport(session: Session, report: Omit<Report, "id">): Report {
  const full: Report = { ...report, id: uid("report") };
  saveReportRecord(full);
  notifyReportSubmitted({
    staffName: session.staffName,
    customerName: full.CustomerName,
    startTime: full.StartTime,
    endTime: full.EndTime,
    psi: full.RiskRating,
    es: full.EsRating,
    internalReport: full.InternalReport,
  });
  return full;
}

export function saveAccidentReport(session: Session, report: Omit<AccidentReport, "id">): AccidentReport {
  const full: AccidentReport = { ...report, id: uid("accident") };
  saveAccidentRecord(full);
  notifyAccidentSubmitted({
    staffName: session.staffName,
    customerName: full.CustomerName,
    reportType: full.ReportType,
    targetName: full.TargetName,
    targetDob: full.TargetDob,
    occurrenceTime: full.OccurrenceTime,
    location: full.Location,
    content: full.AccidentContent,
    situation: full.Situation,
    response: full.ImmediateResponse,
    parentCorrespondence: full.ParentCorrespondence,
    diagnosis: full.DiagnosisTreatment,
    prevention: full.Prevention,
  });
  return full;
}

export function sendVisitCompleteNotification(session: Session, customerName: string, visitDateTime: string): void {
  notifyVisitComplete({ staffName: session.staffName, customerName, visitDateTime });
}

export function markRecentCustomer(session: Session, customerId: string): void {
  pushRecentCustomer(session.staffId, customerId);
}

export function getRecentCustomers(session: Session): string[] {
  return getRecentCustomerIds(session.staffId);
}

// ---------------------------------------------------------------------------
// 領収書
// ---------------------------------------------------------------------------

export function extractAmountFromImage(imageDataUrl: string, seedKey: string): ReceiptOcrResult {
  return ocrExtract(imageDataUrl, seedKey);
}

export interface ReceiptUploadItem {
  imageDataUrl: string;
  amount: number | null;
  title: string;
  customerId: string | null;
  customerName: string | null;
}

export interface ReceiptUploadResultItem {
  receipt: Receipt | null;
  duplicate: boolean;
  duplicateOf: Receipt | null;
}

export function uploadReceiptsOnly(session: Session, items: ReceiptUploadItem[], note: string): ReceiptUploadResultItem[] {
  const results: ReceiptUploadResultItem[] = [];
  const registered: { title: string; amount: number }[] = [];

  for (const item of items) {
    const dup = checkReceiptDuplicate(item.amount, item.title);
    if (dup) {
      results.push({ receipt: null, duplicate: true, duplicateOf: dup });
      continue;
    }
    const receipt: Receipt = {
      id: uid("receipt"),
      datetime: new Date().toISOString(),
      userId: session.staffName,
      customerId: item.customerId,
      customerName: item.customerName,
      amount: item.amount,
      title: item.title,
      imageDataUrl: item.imageDataUrl,
      note,
      duplicateOf: null,
    };
    saveReceiptRecord(receipt);
    registerReceiptDuplicateKey(item.amount, item.title, receipt.id);
    registered.push({ title: item.title, amount: item.amount ?? 0 });
    results.push({ receipt, duplicate: false, duplicateOf: null });
  }

  if (registered.length > 0) {
    const first = items[0];
    notifyReceiptRegistered({
      staffName: session.staffName,
      customerName: first?.customerName ?? null,
      date: new Date().toISOString().slice(0, 10),
      items: registered,
      note,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 管理者設定(Gemini / Webhook)
// ---------------------------------------------------------------------------

export function getGeminiApiKeyForAdmin(session: Session): { masked: string } {
  requireAdmin(session);
  return { masked: maskApiKey(getAdminSettings().geminiApiKey) };
}

export function saveGeminiApiKeyForAdmin(session: Session, apiKey: string): void {
  requireAdmin(session);
  if (!apiKey.trim()) throw new Error("APIキーは空文字では保存できません");
  const settings = getAdminSettings();
  saveAdminSettings({ ...settings, geminiApiKey: apiKey.trim() });
}

export function getGeminiModelSettingsForAdmin(session: Session): AdminSettings["models"] {
  requireAdmin(session);
  return getAdminSettings().models;
}

export function saveGeminiModelSettingsForAdmin(session: Session, models: AdminSettings["models"]): void {
  requireAdmin(session);
  const settings = getAdminSettings();
  saveAdminSettings({ ...settings, models });
}

export function listAvailableGeminiModelsForAdmin(session: Session): string[] {
  requireAdmin(session);
  return AVAILABLE_GEMINI_MODELS;
}

export function getGoogleChatWebhookSettingsForAdmin(session: Session): AdminSettings["webhooks"] {
  requireAdmin(session);
  return getAdminSettings().webhooks;
}

export function saveGoogleChatWebhookSettingsForAdmin(session: Session, webhooks: AdminSettings["webhooks"]): void {
  requireAdmin(session);
  const settings = getAdminSettings();
  saveAdminSettings({ ...settings, webhooks });
}

export { PermissionError };
