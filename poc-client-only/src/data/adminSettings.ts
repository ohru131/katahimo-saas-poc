import type { AdminSettings } from "../types";
import { loadJSON, saveJSON } from "./store";

const KEY = "admin:settings";

const DEFAULTS: AdminSettings = {
  geminiApiKey: "",
  models: { reportModel: "gemini-2.5-flash", ocrModel: "gemini-2.5-flash" },
  webhooks: { dailyReportWebhookUrl: "", receiptWebhookUrl: "" },
};

export const AVAILABLE_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

export function getAdminSettings(): AdminSettings {
  return loadJSON<AdminSettings>(KEY, DEFAULTS);
}

export function saveAdminSettings(settings: AdminSettings): void {
  saveJSON(KEY, settings);
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`;
}
