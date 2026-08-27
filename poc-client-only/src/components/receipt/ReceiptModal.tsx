import { useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { useAppUI } from "../../context/AppUIContext";
import { useSession } from "../../context/SessionContext";
import { extractAmountFromImage, uploadReceiptsOnly } from "../../api";
import type { ReceiptUploadItem, ReceiptUploadResultItem } from "../../api";

const MAX_IMAGES = 6;

interface CapturedImage {
  id: string;
  dataUrl: string;
  amount: number | null;
  title: string;
}

function generateImageId(): string {
  return `receipt-img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 選択された画像ファイルを縮小・圧縮し、JPEGのBase64(DataURL)として返す。 */
function resizeAndCompressImage(file: File, maxDimension = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("画像の読み込みに失敗しました"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("画像の処理に対応していない環境です"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface ReceiptCapturePanelProps {
  customerId: string | null;
  customerName: string | null;
  /** 登録バッチが完了した後に呼ばれる(呼び出し元でモーダルを閉じる/状態リセットする用途)。 */
  onRegistered?: () => void;
}

/**
 * 領収書撮影・OCRプレフィル・重複警告表示・登録を行う本体パネル。
 * スタンドアロンの `ReceiptModal` と、日報モーダル埋め込みの両方から利用される。
 */
export function ReceiptCapturePanel({ customerId, customerName, onRegistered }: ReceiptCapturePanelProps) {
  const { session } = useSession();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<CapturedImage[]>([]);
  const [note, setNote] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ReceiptUploadResultItem[] | null>(null);
  const [submittedImages, setSubmittedImages] = useState<CapturedImage[]>([]);

  const atCapacity = images.length >= MAX_IMAGES;

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const availableSlots = MAX_IMAGES - images.length;

    if (availableSlots <= 0) {
      setAddError(`最大${MAX_IMAGES}枚まで登録できます`);
      return;
    }

    const toProcess = files.slice(0, availableSlots);
    setAddError(files.length > toProcess.length ? `最大${MAX_IMAGES}枚まで登録できます` : null);

    for (const file of toProcess) {
      try {
        const dataUrl = await resizeAndCompressImage(file);
        const id = generateImageId();
        const ocr = extractAmountFromImage(dataUrl, id);
        setImages((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, { id, dataUrl, amount: ocr.amount, title: ocr.title }];
        });
      } catch {
        setAddError("画像の読み込みに失敗しました");
      }
    }
  }

  function updateAmount(id: string, raw: string) {
    setImages((prev) =>
      prev.map((it) => (it.id === id ? { ...it, amount: raw === "" ? null : Number(raw) } : it)),
    );
  }

  function updateTitle(id: string, value: string) {
    setImages((prev) => prev.map((it) => (it.id === id ? { ...it, title: value } : it)));
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((it) => it.id !== id));
    setAddError(null);
  }

  function resetPanel() {
    setImages([]);
    setNote("");
    setAddError(null);
    setResults(null);
    setSubmittedImages([]);
  }

  async function handleSubmit() {
    if (!session || images.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const items: ReceiptUploadItem[] = images.map((img) => ({
        imageDataUrl: img.dataUrl,
        amount: img.amount,
        title: img.title,
        customerId,
        customerName,
      }));
      const res = uploadReceiptsOnly(session, items, note);
      setSubmittedImages(images);
      setResults(res);
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    resetPanel();
  }

  function handleFinish() {
    resetPanel();
    onRegistered?.();
  }

  if (results) {
    return (
      <div className="stack">
        <div className="small muted">登録結果</div>
        {submittedImages.map((img, idx) => {
          const r = results[idx];
          return (
            <div className="app-card" key={img.id}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <img
                  src={img.dataUrl}
                  alt="領収書"
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                />
                <div className="stack" style={{ flex: 1, gap: "0.3em" }}>
                  <div className="small">
                    {img.title || "(店舗名未入力)"} / {img.amount != null ? `${img.amount}円` : "(金額未入力)"}
                  </div>
                  {r?.duplicate ? (
                    <div className="small" style={{ color: "var(--color-warning)" }}>
                      ⚠️ 重複の可能性があるため登録されていません
                      {r.duplicateOf && (
                        <div className="muted">
                          既存登録: {r.duplicateOf.title} / {r.duplicateOf.amount ?? "-"}円 (
                          {r.duplicateOf.datetime.slice(0, 10)})
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="badge">登録済み</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="row">
          <button type="button" className="app-btn secondary" onClick={handleContinue}>
            続けて登録
          </button>
          <button type="button" className="app-btn" onClick={handleFinish}>
            完了
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {customerName && <div className="small muted">訪問先: {customerName}</div>}

      <div className="row">
        <button
          type="button"
          className="app-btn secondary"
          onClick={() => cameraInputRef.current?.click()}
          disabled={atCapacity}
        >
          📷 カメラで撮影
        </button>
        <button
          type="button"
          className="app-btn secondary"
          onClick={() => galleryInputRef.current?.click()}
          disabled={atCapacity}
        >
          🖼 アルバムから選択
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="small muted">
        {images.length}/{MAX_IMAGES}枚
      </div>
      {addError && (
        <div className="small" style={{ color: "var(--color-danger)" }}>
          {addError}
        </div>
      )}

      {images.length === 0 ? (
        <p className="muted small">画像が追加されていません。カメラまたはアルバムから領収書を追加してください。</p>
      ) : (
        <div className="stack">
          {images.map((img) => (
            <div className="app-card" key={img.id}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <img
                  src={img.dataUrl}
                  alt="領収書"
                  style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                />
                <div className="stack" style={{ flex: 1, gap: "0.4em" }}>
                  <div>
                    <label className="field-label">店舗名</label>
                    <input
                      className="field-input"
                      type="text"
                      value={img.title}
                      onChange={(e) => updateTitle(img.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">金額(円)</label>
                    <input
                      className="field-input"
                      type="number"
                      value={img.amount ?? ""}
                      onChange={(e) => updateAmount(img.id, e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="app-icon-btn"
                  onClick={() => removeImage(img.id)}
                  aria-label="この画像を削除"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="field-label">申し送り</label>
        <textarea
          className="field-input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="申し送り事項があれば入力してください"
        />
      </div>

      <button type="button" className="app-btn" onClick={() => void handleSubmit()} disabled={images.length === 0 || submitting || !session}>
        {submitting ? "登録中…" : "登録する"}
      </button>
    </div>
  );
}

/** 領収書登録モーダル(スタンドアロン起動用)。実処理は ReceiptCapturePanel に委譲する薄いラッパー。 */
function ReceiptModal() {
  const { receiptModal, closeReceiptModal } = useAppUI();
  if (!receiptModal.open) return null;
  return (
    <Modal title="領収書登録" onClose={closeReceiptModal}>
      <ReceiptCapturePanel
        customerId={receiptModal.customerId}
        customerName={receiptModal.customerName}
        onRegistered={closeReceiptModal}
      />
    </Modal>
  );
}

export default ReceiptModal;
export { ReceiptModal };
