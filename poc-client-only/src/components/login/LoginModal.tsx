import { useState } from "react";
import { Modal } from "../common/Modal";
import { useSession } from "../../context/SessionContext";
import {
  listAllStaffForLoginPicker,
  loginWithGoogle,
  requestPasswordReset,
  resetPasswordWithCode,
  verifyLogin,
} from "../../domain/auth";

type Mode = "login" | "reset-request" | "reset-confirm";

export function LoginModal() {
  const { setSession } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffId, setStaffId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const staffList = listAllStaffForLoginPicker();

  function doLogin(loginAs?: "admin" | "staff") {
    setError(null);
    try {
      const session = verifyLogin({ email, password, loginAs, staffId: staffId || undefined });
      setSession(session);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function doGoogleLogin() {
    setError(null);
    try {
      const session = loginWithGoogle(staffId || undefined);
      setSession(session);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function submitResetRequest() {
    if (!resetEmail.trim()) {
      setResetMessage("メールアドレスを入力してください");
      return;
    }
    const { code } = requestPasswordReset(resetEmail);
    setIssuedCode(code);
    setResetMessage("認証コードを発行しました(PoCのため画面上に直接表示します。実運用ではメール送信されます)。");
    setMode("reset-confirm");
  }

  function submitResetConfirm() {
    if (!newPassword) {
      setResetMessage("新しいパスワードを入力してください");
      return;
    }
    const ok = resetPasswordWithCode(resetEmail, resetCode, newPassword);
    if (ok) {
      setResetMessage("パスワードを再設定しました。ログイン画面に戻ります。");
      setTimeout(() => {
        setMode("login");
        setResetMessage(null);
        setIssuedCode(null);
      }, 1200);
    } else {
      setResetMessage("認証コードが正しくないか、有効期限が切れています。");
    }
  }

  return (
    <Modal title="保育日報 ログイン" onClose={null}>
      {mode === "login" && (
        <div className="stack">
          <div>
            <label className="field-label" htmlFor="login-email">
              メールアドレス
            </label>
            <input
              id="login-email"
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="login-password">
              パスワード
            </label>
            <input
              id="login-password"
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="任意の文字列でログインできます(PoC)"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="login-staff-picker">
              ログインするスタッフ(デモ用・任意指定)
            </label>
            <select id="login-staff-picker" className="field-input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">自動(メールアドレスに応じて割当)</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isAdmin ? "(管理者)" : ""}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="small" style={{ color: "var(--color-danger)" }}>{error}</p>}

          <button className="app-btn" onClick={() => doLogin()}>
            ログイン
          </button>

          <div className="row" style={{ gap: "0.5em" }}>
            <button className="app-btn secondary" style={{ flex: 1 }} onClick={() => doLogin("admin")}>
              管理者としてログイン
            </button>
            <button className="app-btn secondary" style={{ flex: 1 }} onClick={() => doLogin("staff")}>
              一般スタッフとしてログイン
            </button>
          </div>

          <button className="app-btn secondary" onClick={doGoogleLogin}>
            <span role="img" aria-label="google">🔐</span> Googleでログイン
          </button>

          <button
            className="app-icon-btn small"
            style={{ alignSelf: "center" }}
            onClick={() => {
              setMode("reset-request");
              setResetEmail(email);
              setResetMessage(null);
            }}
          >
            パスワードをお忘れですか?
          </button>
        </div>
      )}

      {mode === "reset-request" && (
        <div className="stack">
          <p className="small muted">登録済みメールアドレスを入力してください。認証コードを発行します。</p>
          <input
            className="field-input"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="staff@example.com"
          />
          {resetMessage && <p className="small">{resetMessage}</p>}
          <button className="app-btn" onClick={submitResetRequest}>
            認証コードを発行する
          </button>
          <button className="app-icon-btn small" style={{ alignSelf: "center" }} onClick={() => setMode("login")}>
            ログイン画面に戻る
          </button>
        </div>
      )}

      {mode === "reset-confirm" && (
        <div className="stack">
          {issuedCode && (
            <p className="app-card" style={{ textAlign: "center", fontSize: "1.3em", letterSpacing: "0.2em" }}>
              認証コード: <strong>{issuedCode}</strong>
            </p>
          )}
          <p className="small muted">30分以内に下記へ入力してください。</p>
          <div>
            <label className="field-label">認証コード(6桁)</label>
            <input className="field-input" value={resetCode} onChange={(e) => setResetCode(e.target.value)} maxLength={6} />
          </div>
          <div>
            <label className="field-label">新しいパスワード</label>
            <input
              className="field-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {resetMessage && <p className="small">{resetMessage}</p>}
          <button className="app-btn" onClick={submitResetConfirm}>
            パスワードを再設定する
          </button>
          <button className="app-icon-btn small" style={{ alignSelf: "center" }} onClick={() => setMode("login")}>
            ログイン画面に戻る
          </button>
        </div>
      )}
    </Modal>
  );
}
