import { useSession } from "../../context/SessionContext";
import { useAppUI } from "../../context/AppUIContext";

export function Header() {
  const { session, logout } = useSession();
  const { openSettings } = useAppUI();

  return (
    <header
      className="row between"
      style={{
        padding: "0.6em 0.9em",
        background: "var(--color-primary)",
        color: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: "1.05em" }}>保育日報</div>
        <div className="small" style={{ opacity: 0.85 }}>
          Ver. 1.0.1
        </div>
      </div>
      <div className="row" style={{ gap: "0.6em" }}>
        {session && (
          <span className="small" style={{ opacity: 0.95 }}>
            {session.staffName}
            {session.isAdmin ? "(管理者)" : ""}
          </span>
        )}
        <button
          className="app-icon-btn"
          style={{ color: "#fff" }}
          onClick={openSettings}
          aria-label="設定"
          title="設定"
        >
          ⚙️
        </button>
        <button className="app-icon-btn" style={{ color: "#fff" }} onClick={logout} aria-label="ログアウト" title="ログアウト">
          🚪
        </button>
      </div>
    </header>
  );
}
