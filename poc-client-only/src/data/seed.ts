import type { Customer, CustomerDetailField, FamilyMember, Staff } from "../types";
import {
  ALLERGIES,
  CUSTOMER_FIGURES,
  FAMILY_FIGURES,
  FAMILY_INFO_NOTES,
  PLACES,
  STAFF_FIGURES,
} from "./historicalFigures";
import { hashStringToSeed, mulberry32, randChoice, randInt, shuffle, type RNG } from "../domain/rng";
import { loadJSON, saveJSON, uid } from "./store";

const CUSTOMERS_KEY = "master:customers";
const STAFF_KEY = "master:staff";
const SEED_VERSION_KEY = "master:seedVersion";
const CURRENT_SEED_VERSION = 3;

function dobFromBirthYear(rng: RNG, birthYear: number): string {
  const y = birthYear;
  const m = randInt(rng, 1, 12);
  const d = randInt(rng, 1, 28);
  const yStr = y < 0 ? `-${String(-y).padStart(4, "0")}` : String(y).padStart(4, "0");
  return `${yStr}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function phoneFor(rng: RNG): string {
  return `090-${String(randInt(rng, 1000, 9999))}-${String(randInt(rng, 1000, 9999))}`;
}

function emailFor(_name: string, index: number): string {
  const slug = index.toString().padStart(3, "0");
  return `dummy.${slug}@rekishi-example.jp`;
}

function buildCustomer(index: number, rng: RNG): Customer {
  const figure = CUSTOMER_FIGURES[index % CUSTOMER_FIGURES.length];
  const place = randChoice(rng, PLACES);
  const dob = dobFromBirthYear(rng, figure.birthYear);
  const id = uid("cust");

  const familyCount = randInt(rng, 0, 2);
  const familyPool = shuffle(rng, FAMILY_FIGURES);
  const family: FamilyMember[] = [];
  for (let i = 0; i < familyCount; i++) {
    const f = familyPool[i];
    family.push({
      name: f.name,
      dob: dobFromBirthYear(rng, f.birthYear),
      job: f.job || (rng() > 0.5 ? "保育園児" : "小学生"),
      allergy: randChoice(rng, ALLERGIES),
      info: randChoice(rng, FAMILY_INFO_NOTES),
    });
  }

  const details: CustomerDetailField[] = [
    { key: "フリガナ", value: "―" },
    { key: "生年月日", value: dob },
    { key: "電話番号", value: phoneFor(rng) },
    { key: "メールアドレス", value: emailFor(figure.name, index) },
    { key: "職業", value: figure.job },
    { key: "契約プラン", value: randChoice(rng, ["ベーシック", "スタンダード", "プレミアム"]) },
    { key: "緊急連絡先", value: phoneFor(rng) },
    { key: "備考", value: randChoice(rng, ["特になし", "駐車場は近隣コインパーキングを利用", "インターホンが壊れているため電話連絡"]) },
  ];

  return {
    id,
    name: figure.name,
    address: place.address,
    city: place.city,
    lat: place.lat + (rng() - 0.5) * 0.01,
    lng: place.lng + (rng() - 0.5) * 0.01,
    family,
    details,
  };
}

function buildStaff(index: number, rng: RNG): Staff {
  const figure = STAFF_FIGURES[index % STAFF_FIGURES.length];
  const place = randChoice(rng, PLACES);
  return {
    id: uid("staff"),
    name: figure.name,
    email: emailFor(figure.name, 1000 + index),
    password: "dummy",
    retiredAt: null,
    isAdmin: figure.isAdmin,
    sessionToken: null,
    sessionExpiresAt: null,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
  };
}

export function getMasterDataVersion(): string {
  return `v${CURRENT_SEED_VERSION}`;
}

export function getMasterCustomers(): Customer[] {
  ensureSeed();
  return loadJSON<Customer[]>(CUSTOMERS_KEY, []);
}

export function getMasterStaff(): Staff[] {
  ensureSeed();
  return loadJSON<Staff[]>(STAFF_KEY, []);
}

export function saveMasterStaff(staff: Staff[]): void {
  saveJSON(STAFF_KEY, staff);
}

export function saveMasterCustomers(customers: Customer[]): void {
  saveJSON(CUSTOMERS_KEY, customers);
}

function ensureSeed(): void {
  const version = loadJSON<number>(SEED_VERSION_KEY, 0);
  if (version === CURRENT_SEED_VERSION) return;

  const rng = mulberry32(hashStringToSeed("hoiku-nippou-poc-seed"));

  const customers: Customer[] = [];
  for (let i = 0; i < CUSTOMER_FIGURES.length; i++) {
    customers.push(buildCustomer(i, rng));
  }

  const staff: Staff[] = [];
  for (let i = 0; i < STAFF_FIGURES.length; i++) {
    staff.push(buildStaff(i, rng));
  }

  saveJSON(CUSTOMERS_KEY, customers);
  saveJSON(STAFF_KEY, staff);
  saveJSON(SEED_VERSION_KEY, CURRENT_SEED_VERSION);
}
