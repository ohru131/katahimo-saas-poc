import type { EventType, SlotKey } from "../../types";

export interface TimelineBlock {
  slotKey: SlotKey;
  title: string;
  eventType: EventType;
  start: string; // HH:mm
  end: string; // HH:mm
}

const RANGE_START_MIN = 8 * 60; // 08:00
const RANGE_END_MIN = 19 * 60; // 19:00
const RANGE_TOTAL = RANGE_END_MIN - RANGE_START_MIN;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function colorForEventType(eventType: EventType): string {
  switch (eventType) {
    case "CUSTOMER_APPOINTMENT":
      return "var(--color-accent)"; // 訪問=青
    case "EVENT":
      return "var(--color-event-teal)"; // イベント=ティール
    case "OFFICE_WORK":
    default:
      return "var(--color-office-gray)"; // 事務作業=グレー
  }
}

interface TimelineProps {
  blocks: TimelineBlock[];
  compact?: boolean;
  onSelect?: (slotKey: SlotKey) => void;
}

/** 時間軸付き色帯(9-18時台を基準に08:00-19:00の範囲で位置決め)。 */
export function Timeline({ blocks, compact = false, onSelect }: TimelineProps) {
  return (
    <div className={`att-timeline ${compact ? "att-timeline-compact" : ""}`}>
      {compact && (
        <>
          <div className="att-timeline-tick" style={{ left: "0%" }} />
          <div className="att-timeline-tick" style={{ left: "50%" }} />
          <div className="att-timeline-tick" style={{ left: "100%" }} />
        </>
      )}
      {!compact &&
        [8, 10, 12, 14, 16, 18].map((h) => {
          const pct = (((h * 60 - RANGE_START_MIN) / RANGE_TOTAL) * 100).toFixed(2);
          return (
            <div key={h} className="att-timeline-hour" style={{ left: `${pct}%` }}>
              <span>{h}時</span>
            </div>
          );
        })}
      {blocks.map((b, idx) => {
        const startMin = Math.max(RANGE_START_MIN, toMinutes(b.start));
        const endMin = Math.min(RANGE_END_MIN, toMinutes(b.end));
        if (endMin <= startMin) return null;
        const leftPct = ((startMin - RANGE_START_MIN) / RANGE_TOTAL) * 100;
        const widthPct = Math.max(2, ((endMin - startMin) / RANGE_TOTAL) * 100);
        return (
          <button
            key={`${b.slotKey}-${idx}`}
            type="button"
            className="att-timeline-block"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              background: colorForEventType(b.eventType),
            }}
            title={`${b.title} ${b.start}〜${b.end}`}
            onClick={() => onSelect?.(b.slotKey)}
          >
            {!compact && <span className="att-timeline-block-label">{b.title}</span>}
          </button>
        );
      })}
    </div>
  );
}
