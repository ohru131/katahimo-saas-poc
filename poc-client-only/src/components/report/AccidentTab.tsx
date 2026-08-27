import { useEffect, useRef, useState } from "react";
import type { AccidentReportType, Customer, Session } from "../../types";
import { generateAccidentReport, saveAccidentReport } from "../../api";
import { DEFAULT_PROMPT_SETTINGS } from "../../data/promptDefaults";
import { loadJSON, saveJSON, removeKey } from "../../data/store";
import { Modal } from "../common/Modal";
import { SaveButton } from "./SaveButton";
import { calcAge } from "./reportUtils";

interface AccidentDraft {
  reportType: AccidentReportType;
  targetName: string;
  targetDob: string;
  occurrenceTime: string;
  location: string;
  memo: string;
  accidentContent: string;
  situation: string;
  immediateResponse: string;
  parentCorrespondence: string;
  diagnosisTreatment: string;
  prevention: string;
  saved: boolean;
}

interface AccidentTabProps {
  session: Session;
  customer: Customer;
  selectedDate: string;
}

const SPEECH_SUPPORTED =
  typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

export function AccidentTab({ session, customer, selectedDate }: AccidentTabProps) {
  const draftKey = `draft:report:${session.staffId}:${customer.id}:accident`;

  const [reportType, setReportType] = useState<AccidentReportType>("事故報告");
  const [targetName, setTargetName] = useState("");
  const [targetDob, setTargetDob] = useState("");
  const [occurrenceTime, setOccurrenceTime] = useState(`${selectedDate}T09:00`);
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");

  const [accidentContent, setAccidentContent] = useState("");
  const [situation, setSituation] = useState("");
  const [immediateResponse, setImmediateResponse] = useState("");
  const [parentCorrespondence, setParentCorrespondence] = useState("");
  const [diagnosisTreatment, setDiagnosisTreatment] = useState("");
  const [prevention, setPrevention] = useState("");

  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const draft = loadJSON<AccidentDraft | null>(draftKey, null);
    if (draft) {
      setReportType(draft.reportType);
      setTargetName(draft.targetName);
      setTargetDob(draft.targetDob);
      setOccurrenceTime(draft.occurrenceTime);
      setLocation(draft.location);
      setMemo(draft.memo);
      setAccidentContent(draft.accidentContent);
      setSituation(draft.situation);
      setImmediateResponse(draft.immediateResponse);
      setParentCorrespondence(draft.parentCorrespondence);
      setDiagnosisTreatment(draft.diagnosisTreatment);
      setPrevention(draft.prevention);
      setSaved(draft.saved);
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(() => {
      const draft: AccidentDraft = {
        reportType,
        targetName,
        targetDob,
        occurrenceTime,
        location,
        memo,
        accidentContent,
        situation,
        immediateResponse,
        parentCorrespondence,
        diagnosisTreatment,
        prevention,
        saved,
      };
      saveJSON(draftKey, draft);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    draftKey,
    reportType,
    targetName,
    targetDob,
    occurrenceTime,
    location,
    memo,
    accidentContent,
    situation,
    immediateResponse,
    parentCorrespondence,
    diagnosisTreatment,
    prevention,
    saved,
  ]);

  function markDirty() {
    setDirty(true);
  }

  function handleSelectFamily(name: string) {
    const member = customer.family.find((f) => f.name === name);
    setTargetName(name);
    if (member) setTargetDob(member.dob);
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

    await new Promise((resolve) => setTimeout(resolve, 300));

    const occurrenceLabel = occurrenceTime ? occurrenceTime.replace("T", " ") : "";
    const result = generateAccidentReport({
      memo,
      reportType,
      targetName,
      targetDob,
      occurrenceTime: occurrenceLabel,
      location,
    });

    finished = true;
    clearTimeout(watchdog);
    setGenerating(false);
    setAccidentContent(result.accidentContent);
    setSituation(result.situation);
    setImmediateResponse(result.immediateResponse);
    setParentCorrespondence(result.parentCorrespondence);
    setDiagnosisTreatment(result.diagnosisTreatment);
    setPrevention(result.prevention);
    setSaved(false);
    setDirty(true);
  }

  function handleSave() {
    saveAccidentReport(session, {
      Timestamp: new Date().toISOString(),
      Reporter: session.staffName,
      CustomerId: customer.id,
      CustomerName: customer.name,
      TargetName: targetName,
      TargetDob: targetDob,
      OccurrenceTime: occurrenceTime,
      Location: location,
      AccidentContent: accidentContent,
      Situation: situation,
      ImmediateResponse: immediateResponse,
      ParentCorrespondence: parentCorrespondence,
      DiagnosisTreatment: diagnosisTreatment,
      Prevention: prevention,
      OriginalInput: memo,
      ReportType: reportType,
    });
    setSaved(true);
    setDirty(false);
    removeKey(draftKey);
  }

  return (
    <div className="stack">
      <div className="app-card stack">
        <div className="row between">
          <span className="field-label" style={{ margin: 0 }}>
            種別
          </span>
          <button type="button" className="app-icon-btn" onClick={() => setShowHint(true)} aria-label="記録のヒントを見る">
            ❓
          </button>
        </div>
        <div className="row">
          <label className="row" style={{ gap: "0.3em" }}>
            <input
              type="radio"
              name="accidentType"
              checked={reportType === "事故報告"}
              onChange={() => {
                setReportType("事故報告");
                markDirty();
              }}
            />
            事故報告
          </label>
          <label className="row" style={{ gap: "0.3em" }}>
            <input
              type="radio"
              name="accidentType"
              checked={reportType === "ヒヤリハット"}
              onChange={() => {
                setReportType("ヒヤリハット");
                markDirty();
              }}
            />
            ヒヤリハット
          </label>
        </div>
      </div>

      <div className="app-card stack">
        {customer.family.length > 0 && (
          <div>
            <span className="field-label">対象のお子様(選択で自動入力)</span>
            <select className="field-input" value="" onChange={(e) => e.target.value && handleSelectFamily(e.target.value)}>
              <option value="">(手入力する)</option>
              {customer.family.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                  {calcAge(f.dob, selectedDate) != null ? `(${calcAge(f.dob, selectedDate)}歳)` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <span className="field-label">対象者氏名</span>
          <input
            className="field-input"
            value={targetName}
            onChange={(e) => {
              setTargetName(e.target.value);
              markDirty();
            }}
          />
        </div>
        <div>
          <span className="field-label">生年月日</span>
          <input
            type="date"
            className="field-input"
            value={targetDob}
            onChange={(e) => {
              setTargetDob(e.target.value);
              markDirty();
            }}
          />
        </div>
        <div>
          <span className="field-label">発生日時</span>
          <input
            type="datetime-local"
            className="field-input"
            value={occurrenceTime}
            onChange={(e) => {
              setOccurrenceTime(e.target.value);
              markDirty();
            }}
          />
        </div>
        <div>
          <span className="field-label">場所</span>
          <input
            className="field-input"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              markDirty();
            }}
          />
        </div>
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
          placeholder={
            reportType === "ヒヤリハット" ? DEFAULT_PROMPT_SETTINGS.PlaceholderHiyari : DEFAULT_PROMPT_SETTINGS.PlaceholderAccident
          }
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            markDirty();
          }}
        />
      </div>

      <button type="button" className="app-btn" disabled={generating} onClick={handleGenerate}>
        {generating ? "生成中…" : "AI生成"}
      </button>

      {generateError && (
        <div className="app-card" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
          {generateError}
        </div>
      )}

      {(accidentContent || situation || immediateResponse) && (
        <div className="app-card stack">
          <span className="field-label">内容</span>
          <textarea className="field-input" rows={4} value={accidentContent} onChange={(e) => { setAccidentContent(e.target.value); setDirty(true); }} />
          <span className="field-label">状況</span>
          <textarea className="field-input" rows={4} value={situation} onChange={(e) => { setSituation(e.target.value); setDirty(true); }} />
          <span className="field-label">対応</span>
          <textarea className="field-input" rows={3} value={immediateResponse} onChange={(e) => { setImmediateResponse(e.target.value); setDirty(true); }} />
          <span className="field-label">保護者対応</span>
          <textarea className="field-input" rows={3} value={parentCorrespondence} onChange={(e) => { setParentCorrespondence(e.target.value); setDirty(true); }} />
          <span className="field-label">診断</span>
          <textarea className="field-input" rows={3} value={diagnosisTreatment} onChange={(e) => { setDiagnosisTreatment(e.target.value); setDirty(true); }} />
          <span className="field-label">今後の対応</span>
          <textarea className="field-input" rows={3} value={prevention} onChange={(e) => { setPrevention(e.target.value); setDirty(true); }} />
        </div>
      )}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <SaveButton saved={saved} dirty={dirty} onSave={handleSave} />
      </div>

      {showHint && (
        <Modal title="事故報告の記録のヒント" onClose={() => setShowHint(false)}>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}>
            {DEFAULT_PROMPT_SETTINGS.HintAccident}
            {"\n\n"}
            {DEFAULT_PROMPT_SETTINGS.PlaceholderAccident}
          </p>
        </Modal>
      )}
    </div>
  );
}
