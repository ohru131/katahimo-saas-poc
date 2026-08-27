import { useEffect, useRef, useState } from "react";
import type { Customer, Session } from "../../types";
import { generateReportWithWarnings, saveReport, sendVisitCompleteNotification } from "../../api";
import { DEFAULT_PROMPT_SETTINGS, PSI_RATING_HINT, ES_RATING_HINT } from "../../data/promptDefaults";
import { loadJSON, saveJSON, removeKey } from "../../data/store";
import { StarRating } from "./StarRating";
import { SaveButton } from "./SaveButton";
import { buildTimeOptions, addMinutesClamped, calcAge, toIsoDateTime } from "./reportUtils";
// TODO: ReceiptCapturePanel は領収書モーダル担当エージェントの実装完了後に解決される想定の named export。
// (受入テスト時点で存在しない場合はビルドを壊さないようフォールバック表示にする)
import { ReceiptCapturePanel } from "../receipt/ReceiptModal";

const TIME_OPTIONS = buildTimeOptions();
const MIN_TIME = TIME_OPTIONS[0];
const MAX_TIME = TIME_OPTIONS[TIME_OPTIONS.length - 1];

interface ReportDraft {
  startTime: string;
  endTime: string;
  targetName: string;
  riskRating: number;
  esRating: number;
  memo: string;
  internalReport: string;
  customerReport: string;
  warnings: string[];
  saved: boolean;
}

function defaultDraft(): ReportDraft {
  return {
    startTime: "09:00",
    endTime: "11:00",
    targetName: "",
    riskRating: 0,
    esRating: 0,
    memo: "",
    internalReport: "",
    customerReport: "",
    warnings: [],
    saved: false,
  };
}

interface ReportTabProps {
  session: Session;
  customer: Customer;
  selectedDate: string;
}

const SPEECH_SUPPORTED =
  typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

export function ReportTab({ session, customer, selectedDate }: ReportTabProps) {
  const draftKey = `draft:report:${session.staffId}:${customer.id}:report`;

  const [startTime, setStartTime] = useState(defaultDraft().startTime);
  const [endTime, setEndTime] = useState(defaultDraft().endTime);
  const [targetName, setTargetName] = useState("");
  const [riskRating, setRiskRating] = useState(0);
  const [esRating, setEsRating] = useState(0);
  const [memo, setMemo] = useState("");
  const [internalReport, setInternalReport] = useState("");
  const [customerReport, setCustomerReport] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [visitCompleteMsg, setVisitCompleteMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const loadedRef = useRef(false);

  // 起動時にドラフトを復元
  useEffect(() => {
    const draft = loadJSON<ReportDraft | null>(draftKey, null);
    if (draft) {
      setStartTime(draft.startTime);
      setEndTime(draft.endTime);
      setTargetName(draft.targetName);
      setRiskRating(draft.riskRating);
      setEsRating(draft.esRating);
      setMemo(draft.memo);
      setInternalReport(draft.internalReport);
      setCustomerReport(draft.customerReport);
      setWarnings(draft.warnings);
      setSaved(draft.saved);
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 入力変更でドラフトをlocalStorageへ自動保存
  useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(() => {
      const draft: ReportDraft = {
        startTime,
        endTime,
        targetName,
        riskRating,
        esRating,
        memo,
        internalReport,
        customerReport,
        warnings,
        saved,
      };
      saveJSON(draftKey, draft);
    }, 400);
    return () => clearTimeout(timer);
  }, [draftKey, startTime, endTime, targetName, riskRating, esRating, memo, internalReport, customerReport, warnings, saved]);

  function markDirty() {
    setDirty(true);
  }

  function handleStartTimeChange(v: string) {
    setStartTime(v);
    setEndTime(addMinutesClamped(v, 120, MIN_TIME, MAX_TIME));
    markDirty();
  }

  function handleMicClick() {
    if (!SPEECH_SUPPORTED) return;
    const SpeechRecognitionCtor =
      (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition;
    if (!recognitionRef.current) {
      const rec = new SpeechRecognitionCtor();
      rec.lang = "ja-JP";
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e: any) => {
        const text = Array.from(e.results as ArrayLike<any>)
          .map((r: any) => r[0]?.transcript ?? "")
          .join("");
        if (text) {
          setMemo((prev) => (prev ? `${prev}${text}` : text));
          markDirty();
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    let finished = false;
    const watchdog = setTimeout(() => {
      if (!finished) {
        setGenerating(false);
        setGenerateError("生成がタイムアウトしました(90秒)。時間をおいて再度お試しください。");
      }
    }, 90000);

    // ローディング演出用の人工的な遅延(ダミーAI生成は同期で瞬時に終わるため)
    await new Promise((resolve) => setTimeout(resolve, 300));

    const result = generateReportWithWarnings({
      customerName: customer.name,
      targetName: targetName || null,
      startTime,
      endTime,
      memo,
      staffName: session.staffName,
      riskRating,
      esRating,
    });

    finished = true;
    clearTimeout(watchdog);
    setGenerating(false);
    setInternalReport(result.internalReport);
    const cr = result.customerReport.includes(session.staffName)
      ? result.customerReport
      : `${result.customerReport}\n担当: ${session.staffName}`;
    setCustomerReport(cr);
    setWarnings(result.warnings);
    setSaved(false);
    setDirty(true);
  }

  function handleSave() {
    saveReport(session, {
      Timestamp: new Date().toISOString(),
      StartTime: startTime,
      EndTime: endTime,
      User: session.staffName,
      CustomerId: customer.id,
      CustomerName: customer.name,
      InputText: memo,
      InternalReport: internalReport,
      CustomerReport: customerReport,
      RiskRating: riskRating,
      EsRating: esRating,
    });
    setSaved(true);
    setDirty(false);
    removeKey(draftKey);
  }

  function handleVisitComplete() {
    const iso = toIsoDateTime(selectedDate, startTime);
    // 通知のみ・保存は行わない
    sendVisitCompleteNotification(session, customer.name, iso);
    setVisitCompleteMsg("訪問完了の通知を送信しました。");
    setTimeout(() => setVisitCompleteMsg(null), 3000);
  }

  return (
    <div className="stack">
      <div className="app-card stack">
        <div className="row">
          <div style={{ flex: 1 }}>
            <span className="field-label">開始時刻</span>
            <select
              className="field-input"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <span className="field-label">終了時刻</span>
            <select
              className="field-input"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                markDirty();
              }}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="field-label">対象のお子様</span>
          <select
            className="field-input"
            value={targetName}
            onChange={(e) => {
              setTargetName(e.target.value);
              markDirty();
            }}
          >
            <option value="">(選択なし)</option>
            {customer.family.map((f) => {
              const age = calcAge(f.dob, selectedDate);
              return (
                <option key={f.name} value={f.name}>
                  {f.name}
                  {age != null ? `(${age}歳)` : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="app-card stack">
        <StarRating label="PSI(リスク評価)" value={riskRating} onChange={(v) => { setRiskRating(v); markDirty(); }} hints={PSI_RATING_HINT} />
        <StarRating label="ES(従業員満足度)" value={esRating} onChange={(v) => { setEsRating(v); markDirty(); }} hints={ES_RATING_HINT} />
      </div>

      <div className="app-card stack">
        <div className="row between">
          <span className="field-label" style={{ margin: 0 }}>
            メモ
          </span>
          {SPEECH_SUPPORTED && (
            <button
              type="button"
              className="app-icon-btn"
              onClick={handleMicClick}
              aria-label="音声入力"
              style={{ color: listening ? "#dc2626" : undefined }}
            >
              🎤{listening ? "…" : ""}
            </button>
          )}
        </div>
        <textarea
          className="field-input"
          rows={6}
          placeholder={DEFAULT_PROMPT_SETTINGS.PlaceholderDaily}
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            markDirty();
          }}
        />
      </div>

      <button type="button" className="app-btn" disabled={generating} onClick={handleGenerate}>
        {generating ? "生成中…" : "日報を作成する"}
      </button>

      {generateError && (
        <div className="app-card" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
          {generateError}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="app-card stack" style={{ borderColor: "var(--color-warning)", background: "#fffaf0" }}>
          {warnings.map((w, i) => (
            <div key={i} className="small" style={{ color: "#92400e" }}>
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      {(internalReport || customerReport) && (
        <div className="app-card stack">
          <span className="field-label">社内向け報告</span>
          <textarea
            className="field-input"
            rows={6}
            value={internalReport}
            onChange={(e) => {
              setInternalReport(e.target.value);
              setDirty(true);
            }}
          />
          <span className="field-label">保護者向け報告</span>
          <textarea
            className="field-input"
            rows={6}
            value={customerReport}
            onChange={(e) => {
              setCustomerReport(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      )}

      <div className="row between">
        <button type="button" className="app-btn secondary" onClick={handleVisitComplete}>
          訪問完了
        </button>
        <SaveButton saved={saved} dirty={dirty} onSave={handleSave} />
      </div>
      {visitCompleteMsg && <div className="small muted">{visitCompleteMsg}</div>}

      <div className="app-card stack">
        <span className="field-label">領収書アップロード</span>
        <ReceiptCapturePanel customerId={customer.id} customerName={customer.name} />
      </div>
    </div>
  );
}
