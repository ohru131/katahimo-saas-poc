// ドメイン型定義。GAS版「保育日報」の完全機能仕様書に準拠。
// サーバーが存在しないため、ここで定義する型がそのままクライアント内データストアのスキーマになる。

export type FontSize = "small" | "medium" | "large";

// ---------------------------------------------------------------------------
// 1.1 Customer / 1.2 Family
// ---------------------------------------------------------------------------

export interface FamilyMember {
  name: string;
  dob: string; // YYYY-MM-DD
  job: string;
  allergy: string;
  info: string;
}

export interface CustomerDetailField {
  key: string;
  value: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  family: FamilyMember[];
  details: CustomerDetailField[]; // 顧客DB全項目(パスワード・顧客ID除く)
}

export interface CustomerListResult {
  cities: string[];
  customers: Customer[];
  version: string;
}

// ---------------------------------------------------------------------------
// 1.3 Staff
// ---------------------------------------------------------------------------

export interface Staff {
  id: string;
  name: string;
  email: string;
  password: string; // PoC: 平文保持(実運用ではSHA-256+salt)
  retiredAt: string | null; // 退職日。nullなら在籍
  isAdmin: boolean;
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  address: string;
  lat: number;
  lng: number; // ルート起点用
}

// ---------------------------------------------------------------------------
// 1.4 Schedule / Appointment
// ---------------------------------------------------------------------------

export type EventType = "CUSTOMER_APPOINTMENT" | "EVENT" | "OFFICE_WORK";

export interface ScheduleEvent {
  id: string;
  staffId: string;
  title: string;
  eventType: EventType;
  start: string; // ISO
  end: string; // ISO
  address: string | null;
  customerId: string | null;
  customerName: string | null;
}

// 軽量版(予定一覧API)
export interface LightAppointment {
  title: string;
  eventType: EventType;
  start: string;
  end: string;
  address: string | null;
}

// ルート付き予定一覧API
export interface RoutedAppointment {
  eventType: EventType;
  customerName: string | null;
  startTime: string;
  endTime: string;
  reservaUrl: string | null;
  customerId: string | null;
  address: string | null;
  moveUrl: string | null;
  moveMin: number | null;
  moveKm: number | null;
  attendanceUrl: string | null; // その日最初の実在訪問先のみ
  attendanceMin: number | null;
  attendanceKm: number | null;
  leavingUrl: string | null; // その日最後の実在訪問先のみ
  leavingMin: number | null;
  leavingKm: number | null;
}

// ---------------------------------------------------------------------------
// 1.5 出勤簿1日分の行データ(A〜AO列相当)
// ---------------------------------------------------------------------------

export type WeatherFlag = boolean; // true = 雪(移動時間 x1.3)

export interface VisitSlotInput {
  customerName: string; // C/L/U
  startTime: string | null; // HH:mm D/M/V
  endTime: string | null; // HH:mm E/N/W
}

export interface OfficeSlotInput {
  name: string; // X/AA
  startTime: string | null; // Y/AB
  endTime: string | null; // Z/AC
}

export interface AttendanceRow {
  date: string; // YYYY-MM-DD
  staffId: string;

  slot1: VisitSlotInput; // C,D,E
  move1to2Min: number | null; // H
  weatherCommute: WeatherFlag; // I (出勤区間の天候)

  slot2: VisitSlotInput; // L,M,N
  move2to3Min: number | null; // Q
  weatherSlot1to2: WeatherFlag; // R (#1→#2区間の天候)

  slot3: VisitSlotInput; // U,V,W

  office1: OfficeSlotInput; // X,Y,Z
  office2: OfficeSlotInput; // AA,AB,AC

  distMove1to2: number | null; // AG
  distMove2to3: number | null; // AH
  distCommute: number | null; // AI 出勤距離
  distLeaving: number | null; // AJ 退勤距離

  shoppingProxyCount: number; // AN 0以上整数
  note: string; // AO
}

// 数式列(閲覧・集計時に都度計算)
export interface AttendanceCalcResult {
  move1to2Start: string | null; // F
  move1to2End: string | null; // G
  move1to2Adjusted: number | null; // J (天候補正後)
  wait1: number | null; // K
  move2to3Start: string | null; // O
  move2to3End: string | null; // P
  move2to3Adjusted: number | null; // S
  wait2: number | null; // T
  coreMinutes: number; // AD 労働時間数(所定内・分)
  overtimeMinutes: number; // AE 残業時間(分)
  totalMoveMinutes: number; // AF 移動時間合計(分) = J + S
  totalDistanceKm: number; // AK 距離合計(km)
  overDistanceCount: number; // AL 基準距離15km超過回数
  visitCount: number; // AM 訪問等回数
}

// ---------------------------------------------------------------------------
// 1.6 日報 / 1.7 事故報告 / 1.8 領収書
// ---------------------------------------------------------------------------

export interface Report {
  id: string;
  Timestamp: string;
  StartTime: string;
  EndTime: string;
  User: string;
  CustomerId: string;
  CustomerName: string;
  InputText: string;
  InternalReport: string;
  CustomerReport: string;
  RiskRating: number; // 0-5 (PSI)
  EsRating: number; // 0-5
}

export type AccidentReportType = "事故報告" | "ヒヤリハット";

export interface AccidentReport {
  id: string;
  Timestamp: string;
  Reporter: string;
  CustomerId: string;
  CustomerName: string;
  TargetName: string;
  TargetDob: string;
  OccurrenceTime: string;
  Location: string;
  AccidentContent: string;
  Situation: string;
  ImmediateResponse: string;
  ParentCorrespondence: string;
  DiagnosisTreatment: string;
  Prevention: string;
  OriginalInput: string;
  ReportType: AccidentReportType;
}

export interface Receipt {
  id: string;
  datetime: string; // 日時
  userId: string; // スタッフ名
  customerId: string | null;
  customerName: string | null;
  amount: number | null;
  title: string; // 名称
  imageDataUrl: string; // Base64/ObjectURL
  note: string; // 申し送り
  duplicateOf: string | null; // 重複検出された場合、対象レシートID
}

// ---------------------------------------------------------------------------
// 1.9 プロンプト設定
// ---------------------------------------------------------------------------

export interface PromptSettings {
  GenerateWithWarnings: string;
  GenerateAccident: string;
  PlaceholderDaily: string;
  PlaceholderAccident: string;
  HintAccident: string;
  PlaceholderHiyari: string;
}

// ---------------------------------------------------------------------------
// 1.10 週間予定イベント(勤怠タブ表示用の中間データ)
// ---------------------------------------------------------------------------

export type SlotKey = "slot1" | "slot2" | "slot3" | "office1" | "office2";

export interface WeeklyScheduleEvent {
  date: string; // YYYY-MM-DD
  slotKey: SlotKey;
  title: string;
  eventType: EventType;
  start: string; // HH:mm
  end: string; // HH:mm
}

// ---------------------------------------------------------------------------
// 認証・セッション
// ---------------------------------------------------------------------------

export interface Session {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
  token: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// 通知ログ
// ---------------------------------------------------------------------------

export type NotificationKind =
  | "REPORT"
  | "ACCIDENT"
  | "VISIT_COMPLETE"
  | "RECEIPT";

export interface NotificationLogEntry {
  id: string;
  timestamp: string;
  kind: NotificationKind;
  webhookTarget: "daily-report" | "receipt";
  message: string;
}

// ---------------------------------------------------------------------------
// 管理者設定
// ---------------------------------------------------------------------------

export interface GeminiModelSettings {
  reportModel: string;
  ocrModel: string;
}

export interface WebhookSettings {
  dailyReportWebhookUrl: string;
  receiptWebhookUrl: string;
}

export interface AdminSettings {
  geminiApiKey: string;
  models: GeminiModelSettings;
  webhooks: WebhookSettings;
}
