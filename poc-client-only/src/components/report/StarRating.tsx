import { useState } from "react";
import { Modal } from "../common/Modal";

interface StarRatingProps {
  label: string;
  value: number; // 0-5 (0=未評価)
  onChange: (value: number) => void;
  hints: Record<number, string>;
}

/** ★タップ式5段階評価 + ヒントモーダル付きの評価UI。日報タブでPSI/ESに使用。 */
export function StarRating({ label, value, onChange, hints }: StarRatingProps) {
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="stack" style={{ gap: "0.3em" }}>
      <div className="row between">
        <span className="field-label" style={{ margin: 0 }}>
          {label}
        </span>
        <button
          type="button"
          className="app-icon-btn"
          style={{ fontSize: "0.9em" }}
          onClick={() => setShowHint(true)}
          aria-label={`${label}のヒントを見る`}
        >
          ❓
        </button>
      </div>
      <div className="row" style={{ gap: "0.15em" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            aria-label={`${n}`}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.6em",
              lineHeight: 1,
              padding: "0.05em",
              color: n <= value ? "#f59e0b" : "#d1d5db",
            }}
          >
            {n <= value ? "★" : "☆"}
          </button>
        ))}
        <span className="small muted">{value > 0 ? hints[value] : "未評価"}</span>
      </div>

      {showHint && (
        <Modal title={`${label}の評価基準`} onClose={() => setShowHint(false)}>
          <div className="stack">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="row" style={{ gap: "0.5em" }}>
                <span className="badge">{n}</span>
                <span className="small">{hints[n]}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
