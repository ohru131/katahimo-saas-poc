import { useState } from "react";
import { Modal } from "../common/Modal";
import { useAppUI } from "../../context/AppUIContext";
import { useSession } from "../../context/SessionContext";
import { getData } from "../../api";
import { ReportTab } from "./ReportTab";
import { AccidentTab } from "./AccidentTab";
import { addDaysStr, formatDateJP, todayStr } from "./reportUtils";

type TabMode = "report" | "accident";

/** 日報/事故報告 作成モーダル(訪問先一覧タブの顧客詳細から起動)。 */
export function ReportAccidentModal() {
  const { reportModal, closeReportModal, openReceiptModal } = useAppUI();
  const { session } = useSession();

  const [tab, setTab] = useState<TabMode>(reportModal.initialTab);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());

  if (!reportModal.open) return null;

  // スタンドアロン(領収書登録専用)モード: 顧客未選択で開かれた場合
  if (reportModal.customerId === null) {
    return (
      <Modal title="領収書登録" onClose={closeReportModal}>
        <div className="stack">
          <p className="muted">顧客が選択されていません。領収書のみ登録できます。</p>
          <button
            type="button"
            className="app-btn"
            onClick={() => {
              closeReportModal();
              openReceiptModal(null, null);
            }}
          >
            領収書登録へ進む
          </button>
          <button type="button" className="app-btn secondary" onClick={closeReportModal}>
            閉じる
          </button>
        </div>
      </Modal>
    );
  }

  if (!session) {
    return (
      <Modal title="日報/事故報告" onClose={closeReportModal}>
        <p className="muted">セッションが無効です。再ログインしてください。</p>
      </Modal>
    );
  }

  const customer = getData().customers.find((c) => c.id === reportModal.customerId);

  if (!customer) {
    return (
      <Modal title="日報/事故報告" onClose={closeReportModal}>
        <p className="muted">顧客情報が見つかりません。</p>
      </Modal>
    );
  }

  const today = todayStr();
  const canGoNext = selectedDate < today;

  return (
    <Modal title={`${customer.name}様 の記録`} onClose={closeReportModal}>
      <div className="stack">
        <div className="row" style={{ gap: 0 }}>
          <button
            type="button"
            className={tab === "report" ? "app-btn" : "app-btn secondary"}
            style={{ flex: 1, borderRadius: "8px 0 0 8px" }}
            onClick={() => setTab("report")}
          >
            保育日報
          </button>
          <button
            type="button"
            className={tab === "accident" ? "app-btn" : "app-btn secondary"}
            style={{ flex: 1, borderRadius: "0 8px 8px 0" }}
            onClick={() => setTab("accident")}
          >
            事故報告
          </button>
        </div>

        <div className="row between app-card">
          <button
            type="button"
            className="app-icon-btn"
            aria-label="前日"
            onClick={() => setSelectedDate((d) => addDaysStr(d, -1))}
          >
            ◀
          </button>
          <span>{formatDateJP(selectedDate)}</span>
          <button
            type="button"
            className="app-icon-btn"
            aria-label="翌日"
            disabled={!canGoNext}
            onClick={() => canGoNext && setSelectedDate((d) => addDaysStr(d, 1))}
          >
            ▶
          </button>
        </div>

        {tab === "report" ? (
          <ReportTab session={session} customer={customer} selectedDate={selectedDate} />
        ) : (
          <AccidentTab session={session} customer={customer} selectedDate={selectedDate} />
        )}
      </div>
    </Modal>
  );
}
