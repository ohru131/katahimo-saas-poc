import { useAppUI, type TabKey } from "../../context/AppUIContext";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "schedule", label: "予定", icon: "🗓️" },
  { key: "customers", label: "訪問先一覧", icon: "🏠" },
  { key: "attendance", label: "勤怠", icon: "🕒" },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useAppUI();
  return (
    <nav
      className="row"
      style={{
        position: "sticky",
        bottom: 0,
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        zIndex: 100,
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          style={{
            flex: 1,
            padding: "0.6em 0",
            background: "transparent",
            border: "none",
            borderTop: activeTab === tab.key ? "2px solid var(--color-primary)" : "2px solid transparent",
            color: activeTab === tab.key ? "var(--color-primary)" : "var(--color-text-muted)",
            fontWeight: activeTab === tab.key ? 700 : 400,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.15em",
          }}
        >
          <span style={{ fontSize: "1.2em" }}>{tab.icon}</span>
          <span className="small">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
