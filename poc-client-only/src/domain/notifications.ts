// Google Chat Webhook通知のダミー代替。実際に外部へPOSTせず、
// 開発者コンソール出力+アプリ内の簡易通知履歴パネル用ログに記録する。

import type { NotificationKind, NotificationLogEntry } from "../types";
import { loadJSON, saveJSON, uid } from "../data/store";

const LOG_KEY = "notifications:log";
const MAX_ENTRIES = 200;

function targetFor(kind: NotificationKind): "daily-report" | "receipt" {
  return kind === "RECEIPT" ? "receipt" : "daily-report";
}

export function logNotification(kind: NotificationKind, message: string): NotificationLogEntry {
  const entry: NotificationLogEntry = {
    id: uid("notif"),
    timestamp: new Date().toISOString(),
    kind,
    webhookTarget: targetFor(kind),
    message,
  };
  // eslint-disable-next-line no-console
  console.info(`[Google Chat Webhook(dummy) -> ${entry.webhookTarget}]`, message);

  const list = loadJSON<NotificationLogEntry[]>(LOG_KEY, []);
  list.unshift(entry);
  saveJSON(LOG_KEY, list.slice(0, MAX_ENTRIES));
  return entry;
}

export function getNotificationLog(): NotificationLogEntry[] {
  return loadJSON<NotificationLogEntry[]>(LOG_KEY, []);
}

// ---------------------------- 付録C: 通知文面テンプレート ----------------------------

export function notifyReportSubmitted(params: {
  staffName: string;
  customerName: string;
  startTime: string;
  endTime: string;
  psi: number;
  es: number;
  internalReport: string;
}): void {
  const rating = params.psi || params.es ? ` / PSI:${params.psi || "-"} ES:${params.es || "-"}` : "";
  logNotification(
    "REPORT",
    `【日報提出】担当:${params.staffName} / 顧客:${params.customerName} / 訪問時間:${params.startTime}〜${params.endTime}${rating}\n${params.internalReport}`,
  );
}

export function notifyAccidentSubmitted(params: {
  staffName: string;
  customerName: string;
  reportType: string;
  targetName: string;
  targetDob: string;
  occurrenceTime: string;
  location: string;
  content: string;
  situation: string;
  response: string;
  parentCorrespondence: string;
  diagnosis: string;
  prevention: string;
}): void {
  logNotification(
    "ACCIDENT",
    `【${params.reportType}】担当:${params.staffName} / 顧客:${params.customerName} / 対象:${params.targetName} / 生年月日:${params.targetDob} / 発生日時:${params.occurrenceTime} / 場所:${params.location} / 内容:${params.content} / 状況:${params.situation} / 対応:${params.response} / 保護者対応:${params.parentCorrespondence} / 診断:${params.diagnosis} / 今後の対応:${params.prevention}`,
  );
}

export function notifyVisitComplete(params: { staffName: string; customerName: string; visitDateTime: string }): void {
  logNotification("VISIT_COMPLETE", `【訪問完了】担当:${params.staffName} / 顧客:${params.customerName} / 訪問日時:${params.visitDateTime}`);
}

export function notifyReceiptRegistered(params: {
  staffName: string;
  customerName: string | null;
  date: string;
  items: { title: string; amount: number }[];
  note: string;
}): void {
  const itemsStr = params.items.map((i) => `${i.title} ¥${i.amount.toLocaleString()}`).join(", ");
  const noteStr = params.note ? ` / 申し送り:${params.note}` : "";
  logNotification(
    "RECEIPT",
    `【領収書登録】担当:${params.staffName}${params.customerName ? ` / 顧客:${params.customerName}` : ""} / 日付:${params.date} / ${itemsStr}${noteStr}`,
  );
}
