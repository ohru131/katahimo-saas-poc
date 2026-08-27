import { useEffect, useRef, useState } from "react";
import type { SlotKey, WeeklyScheduleEvent } from "../../types";
import { useSession } from "../../context/SessionContext";
import { getWeeklyScheduleForStaff } from "../../api";
import { Timeline, colorForEventType, type TimelineBlock } from "./Timeline";
import type { SlotEditHint } from "./SlotEditModal";
import { addDays, formatJpDate, formatWeekLabel, mondayOf, todayStr } from "./dateUtils";

interface WeeklyViewProps {
  staffId: string;
  weekStart: string;
  reloadKey: number;
  onChangeWeekStart: (weekStart: string) => void;
  onSelectDate: (date: string) => void;
  onEditSlot: (date: string, slotKey: SlotKey, hint: SlotEditHint) => void;
}

function toBlocks(events: WeeklyScheduleEvent[]): TimelineBlock[] {
  return events.map((e) => ({ slotKey: e.slotKey, title: e.title, eventType: e.eventType, start: e.start, end: e.end }));
}

const SWIPE_THRESHOLD = 60;

export function WeeklyView({ staffId, weekStart, reloadKey, onChangeWeekStart, onSelectDate, onEditSlot }: WeeklyViewProps) {
  const { session } = useSession();
  const [events, setEvents] = useState<Record<string, WeeklyScheduleEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const generationRef = useRef(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!session) return;
    const myGeneration = ++generationRef.current;
    setLoading(true);
    try {
      const result = getWeeklyScheduleForStaff(session, weekStart, staffId);
      if (myGeneration !== generationRef.current) return; // 古い応答は破棄
      setEvents(result);
      setUpdatedAt(new Date());
    } finally {
      if (myGeneration === generationRef.current) setLoading(false);
    }
  }, [session, staffId, weekStart, reloadKey]);

  if (!session) return null;

  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayStr();

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0) onChangeWeekStart(addDays(weekStart, 7));
    else onChangeWeekStart(addDays(weekStart, -7));
  };

  return (
    <div className="stack att-weekly-view" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="row between att-week-header">
        <button className="app-icon-btn" onClick={() => onChangeWeekStart(addDays(weekStart, -7))} aria-label="前の週">
          ‹
        </button>
        <div className="stack att-week-label-wrap">
          <span className="att-week-label">{formatWeekLabel(weekStart)}</span>
          {updatedAt && (
            <span className="muted small">
              更新: {String(updatedAt.getHours()).padStart(2, "0")}:{String(updatedAt.getMinutes()).padStart(2, "0")}
            </span>
          )}
        </div>
        <button className="app-icon-btn" onClick={() => onChangeWeekStart(addDays(weekStart, 7))} aria-label="次の週">
          ›
        </button>
      </div>
      <button className="app-btn secondary small att-today-btn" onClick={() => onChangeWeekStart(mondayOf(today))}>
        今日
      </button>

      {loading && events && Object.keys(events).length === 0 && <p className="muted small">読み込み中...</p>}

      <div className="stack">
        {dates.map((date) => {
          const dayEvents = events[date] ?? [];
          const blocks = toBlocks(dayEvents);
          const isToday = date === today;
          return (
            <div key={date} className={`app-card stack att-day-card ${isToday ? "att-day-card-today" : ""}`}>
              <button className="att-day-header" onClick={() => onSelectDate(date)}>
                <span>{formatJpDate(date)}</span>
                {isToday && <span className="badge">今日</span>}
              </button>
              {blocks.length === 0 ? (
                <p className="muted small">予定なし</p>
              ) : (
                <>
                  <Timeline
                    blocks={blocks}
                    compact
                    onSelect={(slotKey) => {
                      const ev = dayEvents.find((e) => e.slotKey === slotKey);
                      if (ev) onEditSlot(date, slotKey, { title: ev.title, start: ev.start, end: ev.end });
                    }}
                  />
                  <div className="stack att-event-chip-list">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.slotKey}
                        className="att-event-chip"
                        style={{ borderLeftColor: colorForEventType(ev.eventType) }}
                        onClick={() => onEditSlot(date, ev.slotKey, { title: ev.title, start: ev.start, end: ev.end })}
                      >
                        <span className="small">{ev.title}</span>
                        <span className="muted small">
                          {ev.start}〜{ev.end}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
