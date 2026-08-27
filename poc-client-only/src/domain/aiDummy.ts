// Gemini APIのダミー生成ロジック。実APIキーは使わず、入力メモから
// テンプレート+入力内容の反映で「それらしい」文章を組み立てる。

import type { AccidentReportType } from "../types";
import { PSI_RATING_HINT, ES_RATING_HINT } from "../data/promptDefaults";

export interface ReportGenInput {
  customerName: string;
  targetName: string | null;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  memo: string;
  staffName: string;
  riskRating: number; // 0-5
  esRating: number; // 0-5
}

export interface ReportGenResult {
  internalReport: string;
  customerReport: string;
  warnings: string[];
}

function summarizeMemo(memo: string, maxLen: number): string {
  const trimmed = memo.trim();
  if (trimmed.length === 0) return "(記載なし)";
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

export function generateReportWithWarnings(input: ReportGenInput): ReportGenResult {
  const memo = input.memo.trim();
  const warnings: string[] = [];
  if (memo.length === 0) warnings.push("メモが未入力です。具体的な支援内容を記録してください。");
  else if (memo.length < 20) warnings.push("メモの分量が少ないため、生成内容が簡素になっている可能性があります。");
  if (input.riskRating > 0 && input.riskRating <= 2) {
    warnings.push(`PSI評価が${input.riskRating}(${PSI_RATING_HINT[input.riskRating]})です。管理者への報告を検討してください。`);
  }

  const target = input.targetName ?? "お子様";
  const internalReport = [
    `【訪問記録】${input.customerName}様 (${input.startTime}〜${input.endTime})`,
    `担当: ${input.staffName}`,
    `対象: ${target}`,
    "",
    "■ 支援内容・お客様情報",
    summarizeMemo(memo, 400),
    "",
    `■ 評価: PSI ${input.riskRating || "-"}(${input.riskRating ? PSI_RATING_HINT[input.riskRating] : "未評価"}) / ES ${input.esRating || "-"}(${input.esRating ? ES_RATING_HINT[input.esRating] : "未評価"})`,
  ].join("\n");

  const customerReport = [
    `${input.customerName}様`,
    "",
    `本日 ${input.startTime}〜${input.endTime} にご訪問させていただきました。`,
    summarizeMemo(memo, 250),
    "",
    "何かご不明点がございましたら、いつでもお気軽にお声がけください。",
    `担当: ${input.staffName}`,
  ].join("\n");

  return { internalReport, customerReport, warnings };
}

export interface AccidentGenInput {
  memo: string;
  reportType: AccidentReportType;
  targetName: string;
  targetDob: string;
  occurrenceTime: string;
  location: string;
}

export interface AccidentGenResult {
  accidentContent: string;
  situation: string;
  immediateResponse: string;
  parentCorrespondence: string;
  diagnosisTreatment: string;
  prevention: string;
}

export function generateAccidentReport(input: AccidentGenInput): AccidentGenResult {
  const memo = summarizeMemo(input.memo, 600);
  const isHiyari = input.reportType === "ヒヤリハット";

  return {
    accidentContent: `${input.occurrenceTime || "(時刻未記入)"} 頃、${input.location || "(場所未記入)"}にて発生。\n${memo}`,
    situation: isHiyari
      ? `重大な事故には至らなかったが、以下の状況が確認された。\n${memo}`
      : `発生時の状況は以下の通り。\n${memo}`,
    immediateResponse: "状況を確認のうえ、応急対応を実施。必要に応じて関係者へ連絡した。(入力メモを元に自動生成・要確認)",
    parentCorrespondence: "保護者へ状況を説明し、経過を共有した。(要確認・編集してください)",
    diagnosisTreatment: isHiyari ? "受診・治療の対象となる怪我等は発生していない。" : "必要に応じて医療機関を受診。詳細は個別に追記してください。",
    prevention: isHiyari
      ? "同様のヒヤリハットが重大事故に発展しないよう、要因分析と再発防止策の検討を行う。"
      : "再発防止のため、手順の見直し・スタッフ間での情報共有を行う。",
  };
}

export interface ReceiptOcrResult {
  amount: number;
  title: string;
  datetime: string;
}

const DUMMY_STORE_NAMES = ["イオン", "セブン-イレブン", "西友", "ドラッグストアA", "薬局B", "スーパーC"];

/** 領収書OCRのダミー実装。画像内容は解析せず、それらしい値を機械的に生成する。 */
export function extractAmountFromImage(_imageDataUrl: string, seedKey: string): ReceiptOcrResult {
  // ファイルサイズやタイムスタンプに依存しないよう、呼び出しキーからのみ疑似生成
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  const amount = 100 * (5 + (h % 80)); // 500〜8000円程度
  const title = DUMMY_STORE_NAMES[h % DUMMY_STORE_NAMES.length];
  return { amount, title, datetime: new Date().toISOString() };
}
