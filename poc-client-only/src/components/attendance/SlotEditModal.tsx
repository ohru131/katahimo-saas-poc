import { useEffect, useState } from "react";
import type { AttendanceRow, SlotKey } from "../../types";
import { Modal } from "../common/Modal";
import { useSession } from "../../context/SessionContext";
import { getPastScheduleForDate, updatePastSchedule } from "../../api";
import { formatJpDateLong } from "./dateUtils";
import { invalidateAttendanceCaches } from "./cacheUtil";

const SLOT_LABELS: Record<SlotKey, string> = {
  slot1: "訪問1",
  slot2: "訪問2",
  slot3: "訪問3",
  office1: "事務作業1",
  office2: "事務作業2",
};

const NAME_FIELD_LABEL: Record<SlotKey, string> = {
  slot1: "訪問先名",
  slot2: "訪問先名",
  slot3: "訪問先名",
  office1: "作業名",
  office2: "作業名",
};

export interface SlotEditHint {
  title: string;
  start: string;
  end: string;
}

interface SlotEditModalProps {
  date: string;
  slotKey: SlotKey;
  staffId: string;
  hint?: SlotEditHint | null;
  onClose: () => void;
  onSaved: () => void;
}

function isOfficeSlot(slotKey: SlotKey): boolean {
  return slotKey === "office1" || slotKey === "office2";
}

export function SlotEditModal({ date, slotKey, staffId, hint, onClose, onSaved }: SlotEditModalProps) {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<AttendanceRow | null>(null);
  const [editable, setEditable] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // 取得完了後に編集可能な実データへ差し替える(取得直後はhintで先に表示)。
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        const result = getPastScheduleForDate(session, date, staffId);
        if (cancelled) return;
        setRow(result.row);
        setEditable(result.editable);
        const group = result.row[slotKey];
        const groupName = "customerName" in group ? group.customerName : group.name;
        setName(groupName);
        setStart(group.startTime ?? "");
        setEnd(group.endTime ?? "");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, date, slotKey, staffId]);

  if (!session) return null;

  const buildGroup = (nameValue: string, startValue: string, endValue: string) =>
    isOfficeSlot(slotKey)
      ? { name: nameValue.trim(), startTime: startValue || null, endTime: endValue || null }
      : { customerName: nameValue.trim(), startTime: startValue || null, endTime: endValue || null };

  const persist = (nameValue: string, startValue: string, endValue: string) => {
    if (!row) return;
    setSaving(true);
    setError(null);
    try {
      const merged: AttendanceRow = { ...row, [slotKey]: buildGroup(nameValue, startValue, endValue) };
      updatePastSchedule(session, date, merged, staffId);
      invalidateAttendanceCaches();
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => persist(name, start, end);
  const handleDelete = () => persist("", "", "");

  return (
    <Modal title={`${SLOT_LABELS[slotKey]}を編集`} onClose={saving ? null : onClose}>
      <div className="stack">
        <p className="muted small">{formatJpDateLong(date)}</p>

        {loading && (
          <div className="stack att-slot-loading">
            {hint ? (
              <div className="app-card stack">
                <div className="row between">
                  <strong>{hint.title}</strong>
                  <span className="muted small">
                    {hint.start}〜{hint.end}
                  </span>
                </div>
                <p className="muted small">読み込み中… (読取専用)</p>
              </div>
            ) : (
              <p className="muted small">読み込み中…</p>
            )}
          </div>
        )}

        {!loading && (
          <div className="stack">
            <div>
              <label className="field-label" htmlFor="slot-name">
                {NAME_FIELD_LABEL[slotKey]}
              </label>
              <input
                id="slot-name"
                className="field-input"
                type="text"
                value={name}
                disabled={!editable || saving}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="slot-start">
                  開始
                </label>
                <input
                  id="slot-start"
                  className="field-input"
                  type="time"
                  value={start}
                  disabled={!editable || saving}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="slot-end">
                  終了
                </label>
                <input
                  id="slot-end"
                  className="field-input"
                  type="time"
                  value={end}
                  disabled={!editable || saving}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="small" style={{ color: "var(--color-danger)" }}>{error}</p>}

            {!editable && <p className="muted small">当月外のため保存・削除できません。</p>}

            {editable && (
              <div className="stack">
                {!confirmingDelete ? (
                  <div className="row between">
                    <button
                      className="app-btn danger"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={saving}
                    >
                      削除
                    </button>
                    <button className="app-btn" onClick={handleSave} disabled={saving}>
                      {saving ? "保存中..." : "保存"}
                    </button>
                  </div>
                ) : (
                  <div className="app-card stack">
                    <p className="small">この内容を削除します。よろしいですか?</p>
                    <div className="row between">
                      <button
                        className="app-btn secondary"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={saving}
                      >
                        キャンセル
                      </button>
                      <button className="app-btn danger" onClick={handleDelete} disabled={saving}>
                        {saving ? "削除中..." : "削除する"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
