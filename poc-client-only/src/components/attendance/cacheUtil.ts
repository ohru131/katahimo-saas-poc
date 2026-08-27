// 週間予定・月次集計のlocalStorageキャッシュ(data/store.ts の cacheSet/cacheGet が使う名前空間)を
// 手入力保存・カレンダー反映後に破棄するためのヘルパー。
// data/store.ts 自体は編集不可のため、同じキー命名規則(NS + "api:weekly:"/"api:monthly:")を
// 前提にlocalStorageを直接走査して該当キーのみ削除する。

const NS = "hoiku-nippou-poc:";

export function invalidateAttendanceCaches(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(`${NS}api:weekly:`) || k.startsWith(`${NS}api:monthly:`)) {
        keys.push(k);
      }
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // localStorage不可時は無視(PoCのため致命的でない)
  }
}
