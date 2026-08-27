import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: (() => void) | null; // nullなら閉じられない(処理中など)
  children: ReactNode;
  headerExtra?: ReactNode;
}

export function Modal({ title, onClose, children, headerExtra }: ModalProps) {
  return (
    <div className="app-modal-overlay" onClick={() => onClose?.()}>
      <div className="app-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="app-modal-header">
          <h2 className="app-modal-title">{title}</h2>
          <div className="row">
            {headerExtra}
            {onClose && (
              <button className="app-icon-btn" onClick={onClose} aria-label="閉じる">
                ✕
              </button>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
