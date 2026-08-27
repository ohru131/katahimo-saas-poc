import { useEffect, useMemo, useState } from "react";
import type { RoutedAppointment, Staff } from "../../types";
import {
  buildCustomerMapSearchUrl,
  getActiveStaffNamesForAdmin,
  getRouteForStaffOnDate,
} from "../../api";
import { buildGoogleMapsDirectionsFromCurrentLocationUrl } from "../../domain/routeCalc";
import { useSession } from "../../context/SessionContext";
import { useStaffSelection } from "../../context/StaffSelectionContext";
import { useAppUI } from "../../context/AppUIContext";
import "./ScheduleTab.css";

type DayChoice = "today" | "tomorrow";

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateStrFor(choice: DayChoice): string {
  const d = new Date();
  if (choice === "tomorrow") d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

function formatHm(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatFetchedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m} 時点`;
}

const ICON_BY_TYPE: Record<RoutedAppointment["eventType"], string> = {
  CUSTOMER_APPOINTMENT: "📍",
  OFFICE_WORK: "📝",
  EVENT: "📅",
};

const LABEL_BY_TYPE: Record<RoutedAppointment["eventType"], string> = {
  CUSTOMER_APPOINTMENT: "訪問",
  OFFICE_WORK: "事務作業",
  EVENT: "イベント",
};

interface RouteBlockProps {
  label: string;
  min: number | null;
  km: number | null;
  mapUrl: string | null;
  fromCurrentLocationUrl?: string | null;
}

function RouteBlock({ label, min, km, mapUrl, fromCurrentLocationUrl }: RouteBlockProps) {
  if (min == null && km == null && !mapUrl && !fromCurrentLocationUrl) return null;
  return (
    <div className="route-block">
      <div className="route-block-main">
        <span className="route-block-label">{label}</span>
        {(min != null || km != null) && (
          <span className="muted small">
            {min != null ? `約${min}分` : ""}
            {min != null && km != null ? " / " : ""}
            {km != null ? `${km}km` : ""}
          </span>
        )}
      </div>
      <div className="route-block-links">
        {mapUrl && (
          <a className="app-btn secondary small" href={mapUrl} target="_blank" rel="noreferrer">
            🗺️ 地図で見る
          </a>
        )}
        {fromCurrentLocationUrl && (
          <a className="app-btn secondary small" href={fromCurrentLocationUrl} target="_blank" rel="noreferrer">
            📍 現在地から
          </a>
        )}
      </div>
    </div>
  );
}

export function ScheduleTab() {
  const { session } = useSession();
  const { selectedStaffId, setSelectedStaffId } = useStaffSelection();
  const { navigateToCustomers } = useAppUI();

  const [dayChoice, setDayChoice] = useState<DayChoice>("today");
  const [appointments, setAppointments] = useState<RoutedAppointment[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<Staff[]>([]);

  const dateStr = useMemo(() => dateStrFor(dayChoice), [dayChoice]);

  useEffect(() => {
    if (!session || !session.isAdmin) return;
    setStaffOptions(getActiveStaffNamesForAdmin(session));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (session.isAdmin && !selectedStaffId) {
      setSelectedStaffId(session.staffId);
    }
  }, [session, selectedStaffId, setSelectedStaffId]);

  const targetStaffId = session?.isAdmin ? selectedStaffId || session.staffId : session?.staffId ?? "";

  useEffect(() => {
    if (!session || !targetStaffId) return;
    setLoading(true);
    try {
      const result = getRouteForStaffOnDate(session, dateStr, targetStaffId, false);
      setAppointments(result.appointments);
      setFetchedAt(result.fetchedAt);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, dateStr, targetStaffId]);

  if (!session) return null;

  const handleRefetch = () => {
    setLoading(true);
    try {
      const result = getRouteForStaffOnDate(session, dateStr, targetStaffId, true);
      setAppointments(result.appointments);
      setFetchedAt(result.fetchedAt);
    } finally {
      setLoading(false);
    }
  };

  const firstVisitIdx = appointments.findIndex((a) => a.eventType === "CUSTOMER_APPOINTMENT");
  const lastVisitIdx = (() => {
    for (let i = appointments.length - 1; i >= 0; i--) {
      if (appointments[i].eventType === "CUSTOMER_APPOINTMENT") return i;
    }
    return -1;
  })();

  return (
    <div className="schedule-tab stack">
      <div className="row schedule-day-toggle">
        <button
          className={`app-btn ${dayChoice === "today" ? "" : "secondary"}`}
          onClick={() => setDayChoice("today")}
        >
          今日
        </button>
        <button
          className={`app-btn ${dayChoice === "tomorrow" ? "" : "secondary"}`}
          onClick={() => setDayChoice("tomorrow")}
        >
          明日
        </button>
      </div>

      {session.isAdmin && (
        <div className="stack">
          <label className="field-label" htmlFor="schedule-staff-select">
            対象スタッフ
          </label>
          <select
            id="schedule-staff-select"
            className="field-input"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="row between">
        <button className="app-btn secondary" onClick={handleRefetch} disabled={loading}>
          {fetchedAt ? "🚗 ルート・移動時間を再取得" : "🚗 ルート・移動時間を取得"}
        </button>
        {fetchedAt && <span className="muted small">{formatFetchedAt(fetchedAt)}</span>}
      </div>

      {loading && appointments.length === 0 ? (
        <p className="muted">読み込み中...</p>
      ) : appointments.length === 0 ? (
        <p className="muted">この日の予定はありません</p>
      ) : (
        <div className="stack">
          {appointments.map((a, idx) => {
            const isCustomer = a.eventType === "CUSTOMER_APPOINTMENT";
            const borderColor = isCustomer
              ? "var(--color-accent)"
              : a.eventType === "OFFICE_WORK"
                ? "var(--color-office-gray)"
                : "var(--color-event-teal)";

            const showAttendanceBlock = isCustomer && idx === firstVisitIdx;
            const showLeavingBlock = isCustomer && idx === lastVisitIdx;
            const showMoveBlock = isCustomer && idx !== firstVisitIdx;

            return (
              <div key={idx} className="stack schedule-entry">
                {showAttendanceBlock && (
                  <RouteBlock
                    label="出勤"
                    min={a.attendanceMin}
                    km={a.attendanceKm}
                    mapUrl={a.attendanceUrl}
                    fromCurrentLocationUrl={
                      a.address ? buildGoogleMapsDirectionsFromCurrentLocationUrl(a.address) : null
                    }
                  />
                )}
                {showMoveBlock && (
                  <RouteBlock label="移動" min={a.moveMin} km={a.moveKm} mapUrl={a.moveUrl} />
                )}

                <div
                  className={`app-card schedule-card ${isCustomer ? "clickable" : "disabled"}`}
                  style={{ borderLeft: `5px solid ${borderColor}` }}
                  onClick={isCustomer ? () => navigateToCustomers(a.customerName ?? "") : undefined}
                  role={isCustomer ? "button" : undefined}
                  tabIndex={isCustomer ? 0 : undefined}
                >
                  <div className="row between">
                    <span className="row schedule-card-title">
                      <span>{ICON_BY_TYPE[a.eventType]}</span>
                      <span>{a.customerName ?? LABEL_BY_TYPE[a.eventType]}</span>
                    </span>
                    <span className="muted small">
                      {formatHm(a.startTime)}〜{formatHm(a.endTime)}
                    </span>
                  </div>
                  {isCustomer && a.address && (
                    <div className="row between schedule-card-address">
                      <span className="muted small">{a.address}</span>
                      <a
                        className="app-btn secondary small"
                        href={buildCustomerMapSearchUrl(a.address)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🗺️ 地図で見る
                      </a>
                    </div>
                  )}
                </div>

                {showLeavingBlock && (
                  <RouteBlock label="退勤" min={a.leavingMin} km={a.leavingKm} mapUrl={a.leavingUrl} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
