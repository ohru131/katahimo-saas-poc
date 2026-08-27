import { useEffect, useState } from "react";
import type { AttendanceRow, AttendanceCalcResult } from "../../types";
import { useSession } from "../../context/SessionContext";
import { updatePastSchedule } from "../../api";
import { invalidateAttendanceCaches } from "./cacheUtil";

interface DistancePanelProps {
  date: string;
  staffId: string;
  row: AttendanceRow;
  calc: AttendanceCalcResult;
  editable: boolean;
  onSaved: () => void;
}

function numToStr(n: number | null): string {
  return n == null ? "" : String(n);
}

function strToNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function DistancePanel({ date, staffId, row, calc, editable, onSaved }: DistancePanelProps) {
  const { session } = useSession();

  const [distCommute, setDistCommute] = useState(numToStr(row.distCommute));
  const [distMove1to2, setDistMove1to2] = useState(numToStr(row.distMove1to2));
  const [move1to2Min, setMove1to2Min] = useState(numToStr(row.move1to2Min));
  const [distMove2to3, setDistMove2to3] = useState(numToStr(row.distMove2to3));
  const [move2to3Min, setMove2to3Min] = useState(numToStr(row.move2to3Min));
  const [distLeaving, setDistLeaving] = useState(numToStr(row.distLeaving));
  const [weatherCommute, setWeatherCommute] = useState(row.weatherCommute);
  const [weatherSlot1to2, setWeatherSlot1to2] = useState(row.weatherSlot1to2);
  const [shoppingProxyCount, setShoppingProxyCount] = useState(String(row.shoppingProxyCount));
  const [note, setNote] = useState(row.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDistCommute(numToStr(row.distCommute));
    setDistMove1to2(numToStr(row.distMove1to2));
    setMove1to2Min(numToStr(row.move1to2Min));
    setDistMove2to3(numToStr(row.distMove2to3));
    setMove2to3Min(numToStr(row.move2to3Min));
    setDistLeaving(numToStr(row.distLeaving));
    setWeatherCommute(row.weatherCommute);
    setWeatherSlot1to2(row.weatherSlot1to2);
    setShoppingProxyCount(String(row.shoppingProxyCount));
    setNote(row.note);
  }, [row]);

  if (!session) return null;

  const visitCount = calc.visitCount;
  const showCommuteLeaving = visitCount >= 1;
  const show1to2 = visitCount >= 2;
  const show2to3 = visitCount >= 3;

  const firstName = row.slot1.customerName || null;
  const secondName = row.slot2.customerName || null;
  const thirdName = row.slot3.customerName || null;
  const lastName = thirdName || secondName || firstName;

  const handleSave = () => {
    setError(null);
    const proxyCount = Number(shoppingProxyCount);
    if (!Number.isInteger(proxyCount) || proxyCount < 0) {
      setError("買物代行は0以上の整数で入力してください");
      return;
    }
    setSaving(true);
    try {
      const merged: AttendanceRow = {
        ...row,
        distCommute: strToNum(distCommute),
        distMove1to2: strToNum(distMove1to2),
        move1to2Min: strToNum(move1to2Min),
        distMove2to3: strToNum(distMove2to3),
        move2to3Min: strToNum(move2to3Min),
        distLeaving: strToNum(distLeaving),
        weatherCommute,
        weatherSlot1to2,
        shoppingProxyCount: proxyCount,
        note,
      };
      updatePastSchedule(session, date, merged, staffId);
      invalidateAttendanceCaches();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const disabled = !editable || saving;

  return (
    <div className="app-card stack att-distance-panel">
      <h3 className="att-panel-title">移動・距離・その他</h3>

      {!showCommuteLeaving && <p className="muted small">この日の訪問予定がありません。</p>}

      {showCommuteLeaving && (
        <div className="att-distance-group">
          <div className="row between">
            <strong className="small">出勤{firstName ? `(自宅→${firstName}様)` : ""}</strong>
            <button
              type="button"
              className={`att-weather-btn ${weatherCommute ? "active" : ""}`}
              disabled={disabled}
              onClick={() => setWeatherCommute((v) => !v)}
              aria-pressed={weatherCommute}
              title="雪(移動時間+30%)"
            >
              ❄️
            </button>
          </div>
          <label className="field-label">移動距離(km)</label>
          <input
            className="field-input"
            type="number"
            step="0.1"
            min="0"
            value={distCommute}
            disabled={disabled}
            onChange={(e) => setDistCommute(e.target.value)}
          />
        </div>
      )}

      {show1to2 && (
        <div className="att-distance-group">
          <div className="row between">
            <strong className="small">
              {firstName ?? "訪問1"}様 → {secondName ?? "訪問2"}様
            </strong>
            <button
              type="button"
              className={`att-weather-btn ${weatherSlot1to2 ? "active" : ""}`}
              disabled={disabled}
              onClick={() => setWeatherSlot1to2((v) => !v)}
              aria-pressed={weatherSlot1to2}
              title="雪(移動時間+30%)"
            >
              ❄️
            </button>
          </div>
          <label className="field-label">移動時間(分)</label>
          <input
            className="field-input"
            type="number"
            step="1"
            min="0"
            value={move1to2Min}
            disabled={disabled}
            onChange={(e) => setMove1to2Min(e.target.value)}
          />
          <label className="field-label">移動距離(km)</label>
          <input
            className="field-input"
            type="number"
            step="0.1"
            min="0"
            value={distMove1to2}
            disabled={disabled}
            onChange={(e) => setDistMove1to2(e.target.value)}
          />
        </div>
      )}

      {show2to3 && (
        <div className="att-distance-group">
          <strong className="small">
            {secondName ?? "訪問2"}様 → {thirdName ?? "訪問3"}様
          </strong>
          <label className="field-label">移動時間(分)</label>
          <input
            className="field-input"
            type="number"
            step="1"
            min="0"
            value={move2to3Min}
            disabled={disabled}
            onChange={(e) => setMove2to3Min(e.target.value)}
          />
          <label className="field-label">移動距離(km)</label>
          <input
            className="field-input"
            type="number"
            step="0.1"
            min="0"
            value={distMove2to3}
            disabled={disabled}
            onChange={(e) => setDistMove2to3(e.target.value)}
          />
        </div>
      )}

      {showCommuteLeaving && (
        <div className="att-distance-group">
          <strong className="small">退勤{lastName ? `(${lastName}様→自宅)` : ""}</strong>
          <label className="field-label">移動距離(km)</label>
          <input
            className="field-input"
            type="number"
            step="0.1"
            min="0"
            value={distLeaving}
            disabled={disabled}
            onChange={(e) => setDistLeaving(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="att-shopping-count">
          買物代行(回数)
        </label>
        <input
          id="att-shopping-count"
          className="field-input"
          type="number"
          step="1"
          min="0"
          value={shoppingProxyCount}
          disabled={disabled}
          onChange={(e) => setShoppingProxyCount(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="att-note">
          備考
        </label>
        <textarea
          id="att-note"
          className="field-input"
          rows={3}
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <p className="small" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {!editable && <p className="muted small">当月外のため入力できません。</p>}

      {editable && (
        <button className="app-btn" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      )}
    </div>
  );
}
