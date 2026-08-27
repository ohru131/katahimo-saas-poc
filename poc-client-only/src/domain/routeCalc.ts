// Google Maps(ジオコーディング・ルート計算)のダミー代替。
// 実APIは叩かず、簡易な距離計算+妥当な範囲のランダム値で移動時間・距離を作る。
// 地図リンクは住所文字列ベースの実際のGoogle Maps検索/経路URLを生成する(APIキー不要)。

import type { RNG } from "./rng";
import { randInt } from "./rng";

const AVG_SPEED_KM_PER_HOUR = 25; // 市街地想定の平均移動速度

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface RouteResult {
  km: number;
  minutes: number;
}

/** 2点間の移動距離・時間のダミー算出。実際の緯度経度から簡易計算し、多少のランダム性を加える。 */
export function estimateRoute(
  rng: RNG,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): RouteResult {
  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  // 道なり補正(直線距離の1.2〜1.5倍程度)
  const roadFactor = 1.2 + (randInt(rng, 0, 30) / 100);
  const km = Math.max(0.5, Math.round(straightKm * roadFactor * 10) / 10);
  const overheadMin = randInt(rng, 3, 10); // 駐車・信号待ち等の余裕
  const minutes = Math.max(3, Math.round((km / AVG_SPEED_KM_PER_HOUR) * 60) + overheadMin);
  return { km, minutes };
}

/** 住所が不明・起点なしの場合の完全ダミー値(妥当な範囲のランダム値)。 */
export function randomRoute(rng: RNG): RouteResult {
  const km = Math.round((randInt(rng, 5, 250) / 10)) ; // 0.5〜25.0km
  const minutes = Math.max(3, Math.round((km / AVG_SPEED_KM_PER_HOUR) * 60) + randInt(rng, 3, 10));
  return { km, minutes };
}

export function buildGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** 「現在地から」ボタン用。originを省略すると起動元アプリが現在地を起点として扱う。 */
export function buildGoogleMapsDirectionsFromCurrentLocationUrl(destinationAddress: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationAddress)}`;
}

/** 訪問先間の移動用「地図で見る」ボタン。起点・終点の住所文字列から経路URLを生成する。 */
export function buildGoogleMapsDirectionsUrl(originAddress: string, destinationAddress: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddress)}&destination=${encodeURIComponent(destinationAddress)}`;
}
