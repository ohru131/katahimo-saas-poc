import { Modal } from "../common/Modal";
import { useAppUI } from "../../context/AppUIContext";

/** 日報/事故報告 作成モーダル(実装中のプレースホルダー)。 */
export function ReportAccidentModal() {
  const { reportModal, closeReportModal } = useAppUI();
  if (!reportModal.open) return null;
  return (
    <Modal title={reportModal.initialTab === "accident" ? "事故報告" : "保育日報"} onClose={closeReportModal}>
      <p className="muted">日報/事故報告作成モーダル(実装中)</p>
    </Modal>
  );
}
