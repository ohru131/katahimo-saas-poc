// 認証・セッション(PoC版)。
// メール+パスワードは実在チェックを行わずどんな組み合わせでもログイン成功として扱う。
// Google認証もUI上はGoogleログインボタンだが実質誰でも通す簡易実装。
// どちらの方式でも内部的には「ダミースタッフの誰か」としてログインする。

import type { Session, Staff } from "../types";
import { getMasterStaff, saveMasterStaff } from "../data/seed";
import { hashStringToSeed, mulberry32 } from "./rng";
import { loadJSON, saveJSON, removeKey, uid } from "../data/store";

const SESSION_KEY = "auth:session";
const RESET_CODE_KEY = "auth:resetCodes";
const SESSION_TTL_DAYS = 7;
const SESSION_EXTEND_THRESHOLD_DAYS = 6;

function issueToken(): string {
  return uid("tok");
}

function nowPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function toSession(staff: Staff): Session {
  return {
    staffId: staff.id,
    staffName: staff.name,
    isAdmin: staff.isAdmin,
    token: staff.sessionToken!,
    expiresAt: staff.sessionExpiresAt!,
  };
}

function persistStaffSession(staff: Staff): Staff {
  const all = getMasterStaff();
  const idx = all.findIndex((s) => s.id === staff.id);
  if (idx >= 0) all[idx] = staff;
  saveMasterStaff(all);
  return staff;
}

/** メール文字列から決定論的に既存スタッフへ割り当てる(見つからなければ新規ダミースタッフ扱い)。 */
function resolveStaffByEmail(email: string): Staff {
  const all = getMasterStaff();
  const found = all.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
  if (found) return found;

  const nonAdmins = all.filter((s) => !s.isAdmin);
  const rng = mulberry32(hashStringToSeed(email.trim().toLowerCase() || "anonymous"));
  const pool = nonAdmins.length > 0 ? nonAdmins : all;
  const idx = Math.floor(rng() * pool.length);
  return pool[idx];
}

export interface VerifyLoginParams {
  email: string;
  password: string;
  loginAs?: "admin" | "staff";
  staffId?: string; // デモ導線: 一覧から特定のダミースタッフを直接選ぶ場合
}

export function verifyLogin(params: VerifyLoginParams): Session {
  const all = getMasterStaff();
  let staff: Staff;
  if (params.staffId) {
    staff = all.find((s) => s.id === params.staffId) ?? all[0];
  } else if (params.loginAs === "admin") {
    staff = all.find((s) => s.isAdmin) ?? all[0];
  } else {
    staff = resolveStaffByEmail(params.email);
  }

  staff.sessionToken = issueToken();
  staff.sessionExpiresAt = nowPlusDays(SESSION_TTL_DAYS);
  persistStaffSession(staff);

  const session = toSession(staff);
  saveJSON(SESSION_KEY, session);
  return session;
}

export function loginWithGoogle(staffId?: string): Session {
  const all = getMasterStaff();
  const staff = staffId ? all.find((s) => s.id === staffId) ?? all[0] : all.find((s) => !s.isAdmin) ?? all[0];
  staff.sessionToken = issueToken();
  staff.sessionExpiresAt = nowPlusDays(SESSION_TTL_DAYS);
  persistStaffSession(staff);
  const session = toSession(staff);
  saveJSON(SESSION_KEY, session);
  return session;
}

export function checkSession(): Session | null {
  const session = loadJSON<Session | null>(SESSION_KEY, null);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    removeKey(SESSION_KEY);
    return null;
  }
  const staff = getMasterStaff().find((s) => s.id === session.staffId);
  if (!staff || staff.sessionToken !== session.token) {
    removeKey(SESSION_KEY);
    return null;
  }
  const daysLeft = (new Date(session.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft < SESSION_EXTEND_THRESHOLD_DAYS) {
    staff.sessionExpiresAt = nowPlusDays(SESSION_TTL_DAYS);
    persistStaffSession(staff);
    session.expiresAt = staff.sessionExpiresAt;
    saveJSON(SESSION_KEY, session);
  }
  return session;
}

export function logout(): void {
  const session = loadJSON<Session | null>(SESSION_KEY, null);
  if (session) {
    const staff = getMasterStaff().find((s) => s.id === session.staffId);
    if (staff) {
      staff.sessionToken = null;
      staff.sessionExpiresAt = null;
      persistStaffSession(staff);
    }
  }
  removeKey(SESSION_KEY);
}

export function listAllStaffForLoginPicker(): Staff[] {
  return getMasterStaff();
}

// ------------------------------ パスワードリセット ------------------------------

interface ResetCodeEntry {
  code: string;
  expiresAt: string;
  used: boolean;
}

export function requestPasswordReset(email: string): { code: string } {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const entries = loadJSON<Record<string, ResetCodeEntry>>(RESET_CODE_KEY, {});
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  entries[email.trim().toLowerCase()] = { code, expiresAt, used: false };
  saveJSON(RESET_CODE_KEY, entries);
  // 実メール送信はせず、画面上に直接表示する運用(PoC)
  return { code };
}

export function resetPasswordWithCode(email: string, code: string, newPassword: string): boolean {
  const key = email.trim().toLowerCase();
  const entries = loadJSON<Record<string, ResetCodeEntry>>(RESET_CODE_KEY, {});
  const entry = entries[key];
  if (!entry || entry.used || entry.code !== code || new Date(entry.expiresAt).getTime() < Date.now()) {
    return false;
  }
  entry.used = true;
  saveJSON(RESET_CODE_KEY, entries);

  const staff = resolveStaffByEmail(email);
  staff.password = newPassword;
  persistStaffSession(staff);
  return true;
}

export function changePassword(staffId: string, newPassword: string): boolean {
  if (!newPassword) return false;
  const all = getMasterStaff();
  const staff = all.find((s) => s.id === staffId);
  if (!staff) return false;
  staff.password = newPassword;
  saveMasterStaff(all);
  return true;
}
