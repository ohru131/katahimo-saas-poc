import { Modal } from "../common/Modal";
import { useAppUI } from "../../context/AppUIContext";

/** 領収書登録モーダル(スタンドアロン起動用、実装中のプレースホルダー)。 */
export function ReceiptModal() {
  const { receiptModal, closeReceiptModal } = useAppUI();
  if (!receiptModal.open) return null;
  return (
    <Modal title="領収書登録" onClose={closeReceiptModal}>
      <p className="muted">領収書登録モーダル(実装中)</p>
    </Modal>
  );
}
