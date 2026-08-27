// 日報・事故報告・領収書の永続化(全スタッフ横断の1つのリストとして保持し、
// クエリ時にcustomerId/staffIdでフィルタする)。

import type { AccidentReport, Receipt, Report } from "../types";
import { loadJSON, saveJSON, cacheGet, cacheSet, TTL } from "./store";

const REPORTS_KEY = "records:reports";
const ACCIDENTS_KEY = "records:accidents";
const RECEIPTS_KEY = "records:receipts";
const RECENT_CUSTOMERS_PREFIX = "recent:";

export function getAllReports(): Report[] {
  return loadJSON<Report[]>(REPORTS_KEY, []);
}
export function saveReportRecord(report: Report): void {
  const list = getAllReports();
  list.unshift(report);
  saveJSON(REPORTS_KEY, list);
}

export function getAllAccidentReports(): AccidentReport[] {
  return loadJSON<AccidentReport[]>(ACCIDENTS_KEY, []);
}
export function saveAccidentRecord(report: AccidentReport): void {
  const list = getAllAccidentReports();
  list.unshift(report);
  saveJSON(ACCIDENTS_KEY, list);
}

export function getAllReceipts(): Receipt[] {
  return loadJSON<Receipt[]>(RECEIPTS_KEY, []);
}
export function saveReceiptRecord(receipt: Receipt): void {
  const list = getAllReceipts();
  list.unshift(receipt);
  saveJSON(RECEIPTS_KEY, list);
}

// -------------------------- 最近使った顧客(最大50件) --------------------------

export function getRecentCustomerIds(staffId: string): string[] {
  return loadJSON<string[]>(RECENT_CUSTOMERS_PREFIX + staffId, []);
}

export function pushRecentCustomer(staffId: string, customerId: string): void {
  const list = getRecentCustomerIds(staffId).filter((id) => id !== customerId);
  list.unshift(customerId);
  saveJSON(RECENT_CUSTOMERS_PREFIX + staffId, list.slice(0, 50));
}

// -------------------------- 領収書の重複検出(クライアント側45日保持) --------------------------

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, "");
}

export function checkReceiptDuplicate(amount: number | null, title: string): Receipt | null {
  if (amount == null || !title.trim()) return null; // 金額・店舗名が両方入力時のみ有効
  const key = `receiptDup:${amount}|${normalizeTitle(title)}`;
  const existingId = cacheGet<string>(key);
  if (!existingId) return null;
  return getAllReceipts().find((r) => r.id === existingId) ?? null;
}

export function registerReceiptDuplicateKey(amount: number | null, title: string, receiptId: string): void {
  if (amount == null || !title.trim()) return;
  const key = `receiptDup:${amount}|${normalizeTitle(title)}`;
  cacheSet(key, receiptId, TTL.RECEIPT_DUP);
}
