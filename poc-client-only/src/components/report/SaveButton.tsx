import { useState } from "react";
import { Modal } from "../common/Modal";

interface SaveButtonProps {
  saved: boolean; // これまでに一度でも保存済みか
  dirty: boolean; // 保存後に変更があったか
  onSave: () => void | Promise<void>;
}

/** 日報/事故報告で共通利用する保存ボタン。未保存/保存済み/上書き確認の3状態を持つ。 */
export function SaveButton({ saved, dirty, onSave }: SaveButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const isSavedAndClean = saved && !dirty;

  const handleClick = () => {
    if (isSavedAndClean) return; // 変更なしなら何もしない
    if (saved) {
      setShowConfirm(true);
      return;
    }
    onSave();
  };

  return (
    <>
      <button
        type="button"
        className={isSavedAndClean ? "app-btn secondary" : "app-btn"}
        disabled={isSavedAndClean}
        onClick={handleClick}
      >
        {isSavedAndClean ? "保存済み" : "保存する"}
      </button>

      {showConfirm && (
        <Modal
          title="上書き保存の確認"
          onClose={() => setShowConfirm(false)}
        >
          <div className="stack">
            <p>この内容は既に保存されています。上書きして保存しますか?</p>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="app-btn secondary" onClick={() => setShowConfirm(false)}>
                キャンセル
              </button>
              <button
                className="app-btn"
                onClick={() => {
                  setShowConfirm(false);
                  onSave();
                }}
              >
                上書きして保存
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
