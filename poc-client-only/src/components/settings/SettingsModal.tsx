import { Modal } from "../common/Modal";
import { useAppUI } from "../../context/AppUIContext";

/** 設定モーダル(実装中のプレースホルダー)。 */
export function SettingsModal() {
  const { settingsOpen, closeSettings } = useAppUI();
  if (!settingsOpen) return null;
  return (
    <Modal title="設定" onClose={closeSettings}>
      <p className="muted">設定モーダル(実装中)</p>
    </Modal>
  );
}
