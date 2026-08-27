// ダミースケジュール生成ロジック。
// ログイン日時を基準に前後1週間程度の範囲でランダムに予定(顧客訪問/事務作業/イベント)を生成する。
// 「予定」タブ用データと「勤怠」タブ(出勤簿)用データが整合するよう、1日分の生成結果を
// 両タブで共用できる形(DayBundle)にまとめて返す。
// 同一スタッフ・同一日付なら常に同じ内容になるよう、staffId+日付から決定論的に生成する
// (localStorageへの手入力・カレンダー反映の上書きは別レイヤーで管理し、こちらは「基準値」)。

import type { AttendanceRow, Customer, EventType, ScheduleEvent, Staff } from "../types";
import { hashStringToSeed, mulberry32, randChoice, randInt, shuffle, type RNG } from "./rng";
import { classifyEvent } from "./eventClassify";
import { estimateRoute, type RouteResult } from "./routeCalc";

export interface RouteMeta {
  move1to2: RouteResult | null;
  move2to3: RouteResult | null;
  commute: RouteResult | null; // 出勤(自宅→最初の訪問先)
  leaving: RouteResult | null; // 退勤(最後の訪問先→自宅)
}

export interface DayBundle {
  date: string;
  events: ScheduleEvent[];
  attendanceRow: AttendanceRow;
  routeMeta: RouteMeta;
}

const OFFICE_NAMES = ["事務作業", "記録入力", "電話対応", "mtg(定例会議)", "書類整理", "報告書作成"];
const EVENT_NAMES = ["スタッフ研修", "避難訓練", "全体会議", "地域交流イベント"];
const VISIT_DURATIONS = [60, 90, 120];
const OFFICE_DURATIONS = [30, 45, 60];
const EVENT_DURATIONS = [60, 120, 180];

const DAY_START_MIN = 9 * 60;
const DAY_END_MIN = 18 * 60;

type SlotKind = "customer" | "office" | "event";

function seedFor(staffId: string, date: string): number {
  return hashStringToSeed(`${staffId}|${date}`);
}

function pickComposition(rng: RNG): SlotKind[] {
  // 1日あたりの件数: 0〜4件程度(常識的な範囲)
  const roll = randInt(rng, 0, 9);
  const total = roll <= 1 ? 0 : roll <= 4 ? 1 : roll <= 7 ? 2 : roll === 8 ? 3 : 4;

  const kinds: SlotKind[] = [];
  let customerCount = 0;
  let officeCount = 0;
  let eventCount = 0;
  for (let i = 0; i < total; i++) {
    const r = rng();
    if (r < 0.65 && customerCount < 3) {
      kinds.push("customer");
      customerCount++;
    } else if (r < 0.9 && officeCount < 2) {
      kinds.push("office");
      officeCount++;
    } else if (eventCount < 1) {
      kinds.push("event");
      eventCount++;
    } else if (customerCount < 3) {
      kinds.push("customer");
      customerCount++;
    } else if (officeCount < 2) {
      kinds.push("office");
      officeCount++;
    }
    // 上限に達していて割り振れない場合はこの1件をスキップ(常識的な範囲を優先)
  }
  return kinds;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateDaySchedule(staff: Staff, customers: Customer[], date: string): DayBundle {
  const rng = mulberry32(seedFor(staff.id, date));
  const kinds = pickComposition(rng);
  const shuffledCustomers = shuffle(rng, customers);

  interface PlacedItem {
    kind: SlotKind;
    title: string;
    startMin: number;
    endMin: number;
    customer: Customer | null;
  }

  const placed: PlacedItem[] = [];
  let cursor = DAY_START_MIN + randInt(rng, 0, 30);
  let customerIdx = 0;
  let lastCustomer: Customer | null = null;

  for (const kind of kinds) {
    let gap: number;
    if (kind === "customer" && lastCustomer) {
      const nextCustomer = shuffledCustomers[customerIdx % shuffledCustomers.length];
      gap = estimateRoute(rng, lastCustomer, nextCustomer).minutes;
    } else {
      gap = randInt(rng, 10, 30);
    }
    const start = placed.length === 0 ? cursor : cursor + gap;

    let duration: number;
    let title: string;
    let customer: Customer | null = null;
    if (kind === "customer") {
      customer = shuffledCustomers[customerIdx % shuffledCustomers.length];
      customerIdx++;
      duration = randChoice(rng, VISIT_DURATIONS);
      title = `[予約確定] ${customer.name}様`;
      lastCustomer = customer;
    } else if (kind === "office") {
      duration = randChoice(rng, OFFICE_DURATIONS);
      title = `[事務]${randChoice(rng, OFFICE_NAMES)}`;
    } else {
      duration = randChoice(rng, EVENT_DURATIONS);
      title = `[イベント]${randChoice(rng, EVENT_NAMES)}`;
    }

    const end = start + duration;
    if (end > DAY_END_MIN) break; // 常識的な範囲(9-18時)に収める
    placed.push({ kind, title, startMin: start, endMin: end, customer });
    cursor = end;
  }

  const events: ScheduleEvent[] = placed.map((p) => ({
    id: `${staff.id}_${date}_${p.startMin}`,
    staffId: staff.id,
    title: p.title,
    eventType: classifyEvent(p.title, p.startMin, p.endMin) as EventType,
    start: `${date}T${fromMinutes(p.startMin)}:00`,
    end: `${date}T${fromMinutes(p.endMin)}:00`,
    address: p.customer ? p.customer.address : null,
    customerId: p.customer ? p.customer.id : null,
    customerName: p.customer ? p.customer.name : null,
  }));

  const customerVisits = placed.filter((p) => p.kind === "customer" && p.customer);
  const officeBlocks = placed.filter((p) => p.kind === "office");

  const slot = (idx: number) =>
    customerVisits[idx]
      ? {
          customerName: customerVisits[idx].customer!.name,
          startTime: fromMinutes(customerVisits[idx].startMin),
          endTime: fromMinutes(customerVisits[idx].endMin),
        }
      : { customerName: "", startTime: null, endTime: null };

  const officeSlot = (idx: number) =>
    officeBlocks[idx]
      ? {
          name: officeBlocks[idx].title.replace(/^\[事務\]/, ""),
          startTime: fromMinutes(officeBlocks[idx].startMin),
          endTime: fromMinutes(officeBlocks[idx].endMin),
        }
      : { name: "", startTime: null, endTime: null };

  const move1to2 =
    customerVisits[0] && customerVisits[1]
      ? estimateRoute(rng, customerVisits[0].customer!, customerVisits[1].customer!)
      : null;
  const move2to3 =
    customerVisits[1] && customerVisits[2]
      ? estimateRoute(rng, customerVisits[1].customer!, customerVisits[2].customer!)
      : null;
  const commute = customerVisits[0] ? estimateRoute(rng, staff, customerVisits[0].customer!) : null;
  const lastVisit = customerVisits[customerVisits.length - 1];
  const leaving = lastVisit ? estimateRoute(rng, lastVisit.customer!, staff) : null;

  const attendanceRow: AttendanceRow = {
    date,
    staffId: staff.id,
    slot1: slot(0),
    move1to2Min: move1to2 ? move1to2.minutes : null,
    weatherCommute: rng() < 0.08,
    slot2: slot(1),
    move2to3Min: move2to3 ? move2to3.minutes : null,
    weatherSlot1to2: rng() < 0.08,
    slot3: slot(2),
    office1: officeSlot(0),
    office2: officeSlot(1),
    distMove1to2: move1to2 ? move1to2.km : null,
    distMove2to3: move2to3 ? move2to3.km : null,
    distCommute: commute ? commute.km : null,
    distLeaving: leaving ? leaving.km : null,
    shoppingProxyCount: rng() < 0.12 ? randInt(rng, 1, 3) : 0,
    note: "",
  };

  return {
    date,
    events,
    attendanceRow,
    routeMeta: { move1to2, move2to3, commute, leaving },
  };
}

export function dateRange(center: Date, daysBefore: number, daysAfter: number): string[] {
  const dates: string[] = [];
  for (let i = -daysBefore; i <= daysAfter; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    dates.push(toDateStr(d));
  }
  return dates;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
