import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { useAppUI } from "../../context/AppUIContext";
import { useSettings } from "../../context/SettingsContext";
import { useSession } from "../../context/SessionContext";
import type { FontSize, NotificationLogEntry } from "../../types";
import { changePassword } from "../../domain/auth";
import { getNotificationLog } from "../../domain/notifications";
import {
  getGeminiApiKeyForAdmin,
  saveGeminiApiKeyForAdmin,
  getGeminiModelSettingsForAdmin,
  saveGeminiModelSettingsForAdmin,
  listAvailableGeminiModelsForAdmin,
  getGoogleChatWebhookSettingsForAdmin,
  saveGoogleChatWebhookSettingsForAdmin,
} from "../../api";
import "./SettingsModal.css";

type Msg = { type: "ok" | "err"; text: string } | null;

const FONT_SIZE_LABELS: { key: FontSize; label: string }[] = [
  { key: "small", label: "小" },
  { key: "medium", label: "中" },
  { key: "large", label: "大" },
];

const NOTIF_KIND_LABEL: Record<NotificationLogEntry["kind"], string> = {
  REPORT: "日報",
  ACCIDENT: "事故/ヒヤリハット",
  VISIT_COMPLETE: "訪問完了",
  RECEIPT: "領収書",
};

/** 設定モーダル(⚙️)。文字サイズ・パスワード変更・管理者専用設定。 */
export function SettingsModal() {
  const { settingsOpen, closeSettings } = useAppUI();
  const { fontSize, setFontSize } = useSettings();
  const { session } = useSession();

  // --- パスワード変更 ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<Msg>(null);

  // --- 管理者専用: 読込状態 ---
  const [adminLoaded, setAdminLoaded] = useState(false);

  // Gemini APIキー
  const [maskedKey, setMaskedKey] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [geminiMsg, setGeminiMsg] = useState<Msg>(null);

  // 生成/OCRモデル
  const [reportModel, setReportModel] = useState("");
  const [ocrModel, setOcrModel] = useState("");
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsMsg, setModelsMsg] = useState<Msg>(null);

  // Google Chat Webhook
  const [dailyReportWebhookUrl, setDailyReportWebhookUrl] = useState("");
  const [receiptWebhookUrl, setReceiptWebhookUrl] = useState("");
  const [webhooksMsg, setWebhooksMsg] = useState<Msg>(null);

  // 通知ログ(任意のおまけ機能)
  const [notifLogOpen, setNotifLogOpen] = useState(false);
  const [notifLog, setNotifLog] = useState<NotificationLogEntry[]>([]);

  const [saveErrorMsg, setSaveErrorMsg] = useState<Msg>(null);

  // モーダルを開くたびに入力状態をリセットし、管理者設定を(疑似的に非同期で)読み込む
  useEffect(() => {
    if (!settingsOpen) return;

    setCurrentPassword("");
    setNewPassword("");
    setPasswordMsg(null);
    setGeminiKeyInput("");
    setGeminiMsg(null);
    setModelsMsg(null);
    setWebhooksMsg(null);
    setSaveErrorMsg(null);
    setNotifLog(getNotificationLog());

    if (!session?.isAdmin) return;

    setAdminLoaded(false);
    let cancelled = false;
    const keyRes = getGeminiApiKeyForAdmin(session);
    const modelsRes = getGeminiModelSettingsForAdmin(session);
    const webhooksRes = getGoogleChatWebhookSettingsForAdmin(session);

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setMaskedKey(keyRes.masked);
      setReportModel(modelsRes.reportModel);
      setOcrModel(modelsRes.ocrModel);
      setModelOptions(Array.from(new Set([modelsRes.reportModel, modelsRes.ocrModel])));
      setDailyReportWebhookUrl(webhooksRes.dailyReportWebhookUrl);
      setReceiptWebhookUrl(webhooksRes.receiptWebhookUrl);
      setAdminLoaded(true);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  if (!settingsOpen || !session) return null;

  const handleChangePassword = () => {
    const ok = changePassword(session.staffId, newPassword);
    if (ok) {
      setPasswordMsg({ type: "ok", text: "パスワードを変更しました。" });
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setPasswordMsg({ type: "err", text: "新しいパスワードを入力してください。" });
    }
  };

  const handleFetchModels = () => {
    const list = listAvailableGeminiModelsForAdmin(session);
    setModelOptions(Array.from(new Set([...list, reportModel, ocrModel].filter(Boolean))));
    setModelsMsg({ type: "ok", text: "モデル一覧を取得しました。" });
  };

  const handleCancel = () => {
    closeSettings();
  };

  const handleSaveAndClose = () => {
    if (session.isAdmin) {
      if (!adminLoaded) {
        setSaveErrorMsg({ type: "err", text: "読み込み中のため保存できません。しばらくお待ちください。" });
        return;
      }

      if (geminiKeyInput.trim()) {
        try {
          saveGeminiApiKeyForAdmin(session, geminiKeyInput.trim());
        } catch (e) {
          setGeminiMsg({ type: "err", text: (e as Error).message });
          return;
        }
      }

      try {
        saveGeminiModelSettingsForAdmin(session, { reportModel, ocrModel });
      } catch (e) {
        setModelsMsg({ type: "err", text: (e as Error).message });
        return;
      }

      try {
        saveGoogleChatWebhookSettingsForAdmin(session, {
          dailyReportWebhookUrl,
          receiptWebhookUrl,
        });
      } catch (e) {
        setWebhooksMsg({ type: "err", text: (e as Error).message });
        return;
      }
    }
    closeSettings();
  };

  const saveDisabled = session.isAdmin && !adminLoaded;

  return (
    <Modal title="設定" onClose={closeSettings}>
      <div className="stack">
        {/* 文字サイズ設定 */}
        <section className="stack">
          <p className="settings-section-title">文字サイズ</p>
          <div className="font-size-options">
            {FONT_SIZE_LABELS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={fontSize === opt.key ? "app-btn" : "app-btn secondary"}
                onClick={() => setFontSize(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <hr className="settings-divider" />

        {/* パスワード変更 */}
        <section className="stack">
          <p className="settings-section-title">パスワード変更</p>
          <label>
            <span className="field-label">現在のパスワード(任意)</span>
            <input
              className="field-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="現在のパスワード"
              autoComplete="current-password"
            />
          </label>
          <label>
            <span className="field-label">新しいパスワード</span>
            <input
              className="field-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード"
              autoComplete="new-password"
            />
          </label>
          <div className="row between">
            <button type="button" className="app-btn secondary" onClick={handleChangePassword}>
              変更する
            </button>
            {passwordMsg && (
              <span className={`settings-msg ${passwordMsg.type === "ok" ? "ok" : "err"}`}>{passwordMsg.text}</span>
            )}
          </div>
        </section>

        {session.isAdmin && (
          <>
            <hr className="settings-divider" />

            <section className="stack">
              <p className="settings-section-title">管理者専用設定</p>
              {!adminLoaded && <p className="muted small">読み込み中…</p>}

              {/* Gemini APIキー */}
              <div className="app-card stack">
                <p className="field-label" style={{ margin: 0 }}>
                  Gemini APIキー
                </p>
                <p className="small muted">
                  現在のキー: {adminLoaded ? maskedKey || "(未設定)" : "読み込み中…"}
                </p>
                <input
                  className="field-input"
                  type="text"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="新しいAPIキーを入力(変更する場合のみ)"
                  disabled={!adminLoaded}
                />
                <p className="small muted">空欄のまま保存すると、APIキーは変更されません。</p>
                {geminiMsg && (
                  <span className={`settings-msg ${geminiMsg.type === "ok" ? "ok" : "err"}`}>{geminiMsg.text}</span>
                )}
              </div>

              {/* 生成/OCRモデル選択 */}
              <div className="app-card stack">
                <p className="field-label" style={{ margin: 0 }}>
                  生成/OCRモデル選択
                </p>
                <label>
                  <span className="field-label">日報生成モデル</span>
                  <select
                    className="field-input"
                    value={reportModel}
                    onChange={(e) => setReportModel(e.target.value)}
                    disabled={!adminLoaded}
                  >
                    {modelOptions.length === 0 && reportModel && <option value={reportModel}>{reportModel}</option>}
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">OCRモデル</span>
                  <select
                    className="field-input"
                    value={ocrModel}
                    onChange={(e) => setOcrModel(e.target.value)}
                    disabled={!adminLoaded}
                  >
                    {modelOptions.length === 0 && ocrModel && <option value={ocrModel}>{ocrModel}</option>}
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row between">
                  <button type="button" className="app-btn secondary" onClick={handleFetchModels} disabled={!adminLoaded}>
                    モデル一覧取得
                  </button>
                  {modelsMsg && (
                    <span className={`settings-msg ${modelsMsg.type === "ok" ? "ok" : "err"}`}>{modelsMsg.text}</span>
                  )}
                </div>
              </div>

              {/* Google Chat Webhook URL */}
              <div className="app-card stack">
                <p className="field-label" style={{ margin: 0 }}>
                  Google Chat Webhook URL
                </p>
                <label>
                  <span className="field-label">日報用</span>
                  <input
                    className="field-input"
                    type="text"
                    value={dailyReportWebhookUrl}
                    onChange={(e) => setDailyReportWebhookUrl(e.target.value)}
                    placeholder="https://chat.googleapis.com/..."
                    disabled={!adminLoaded}
                  />
                </label>
                <label>
                  <span className="field-label">領収書用</span>
                  <input
                    className="field-input"
                    type="text"
                    value={receiptWebhookUrl}
                    onChange={(e) => setReceiptWebhookUrl(e.target.value)}
                    placeholder="https://chat.googleapis.com/..."
                    disabled={!adminLoaded}
                  />
                </label>
                {webhooksMsg && (
                  <span className={`settings-msg ${webhooksMsg.type === "ok" ? "ok" : "err"}`}>{webhooksMsg.text}</span>
                )}
              </div>

              {/* 通知ログ(おまけ機能) */}
              <div className="app-card stack">
                <button
                  type="button"
                  className="app-btn secondary"
                  onClick={() => setNotifLogOpen((v) => !v)}
                >
                  通知ログ {notifLogOpen ? "▲" : "▼"}
                </button>
                {notifLogOpen && (
                  <div className="notif-log-list">
                    {notifLog.length === 0 && <p className="muted small">通知履歴はありません。</p>}
                    {notifLog.slice(0, 20).map((entry) => (
                      <div key={entry.id} className="notif-log-entry stack">
                        <div className="row between">
                          <span className="badge">{NOTIF_KIND_LABEL[entry.kind]}</span>
                          <span className="small muted">{new Date(entry.timestamp).toLocaleString("ja-JP")}</span>
                        </div>
                        <p className="small notif-log-message">{entry.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {saveErrorMsg && <span className="settings-msg err">{saveErrorMsg.text}</span>}

        <div className="settings-footer">
          <button type="button" className="app-btn secondary" onClick={handleCancel}>
            キャンセル
          </button>
          <button type="button" className="app-btn" onClick={handleSaveAndClose} disabled={saveDisabled}>
            保存して閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
}
