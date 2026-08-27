// 決定論的な擬似乱数生成(同一シードなら同一結果)。
// ダミースタッフ切替時や再読込時に「実行中は一貫した内容」を保つために使う。

export type RNG = () => number; // [0, 1)

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randInt(rng: RNG, min: number, max: number): number {
  // 両端含む
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randChoice<T>(rng: RNG, arr: readonly T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)];
}

export function shuffle<T>(rng: RNG, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
