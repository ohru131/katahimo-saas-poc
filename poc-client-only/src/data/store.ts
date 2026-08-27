// localStorage永続化レイヤー。サーバーが存在しないため、
// 「メモリ内データストア」の永続化先としてlocalStorageを使う。
// TTL付きキャッシュ(予定+ルート2時間・週間予定2時間・月次集計2時間・領収書重複キー45日)も
// ここで共通実装する。

const NS = "hoiku-nippou-poc:";

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    // localStorage満杯・不可時は無視(PoCのため致命的でない)
  }
}

export function removeKey(key: string): void {
  localStorage.removeItem(NS + key);
}

export function clearAll(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(NS));
  for (const k of keys) localStorage.removeItem(k);
}

// ------------------------------- TTLキャッシュ -------------------------------

interface CacheEnvelope<T> {
  storedAt: number; // epoch ms
  ttlMs: number;
  value: T;
}

export function cacheGet<T>(key: string): T | null {
  const env = loadJSON<CacheEnvelope<T> | null>(key, null);
  if (!env) return null;
  if (Date.now() - env.storedAt > env.ttlMs) {
    removeKey(key);
    return null;
  }
  return env.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const env: CacheEnvelope<T> = { storedAt: Date.now(), ttlMs, value };
  saveJSON(key, env);
}

export function cacheClear(key: string): void {
  removeKey(key);
}

export const TTL = {
  SCHEDULE_ROUTE: 2 * 60 * 60 * 1000, // 予定+ルート 2時間
  WEEKLY_SCHEDULE: 2 * 60 * 60 * 1000, // 週間予定 2時間
  MONTHLY_SUMMARY: 2 * 60 * 60 * 1000, // 月次集計 2時間
  RECEIPT_DUP: 45 * 24 * 60 * 60 * 1000, // 領収書重複キー 45日
  STAFF_MASTER: 30 * 60 * 1000, // スタッフ/顧客マスタ 30分(サーバー相当層)
  ROUTE_RESULT: 2 * 60 * 60 * 1000, // ルート結果 2時間(サーバー相当層)
  CUSTOMER_DB: 6 * 60 * 60 * 1000, // 顧客DB 6時間(サーバー相当層)
} as const;

export function uid(prefix = ""): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}_${id}` : id;
}
