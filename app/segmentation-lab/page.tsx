"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpFromLine, CheckCircle2, ImagePlus, Layers3, SplitSquareVertical, Trees, TriangleAlert, Waves, X } from "lucide-react";

/* ─────────────────── Types ─────────────────── */

type ClassKey = 0 | 1 | 2 | 3 | 4;

type ClassSummary = {
  id: ClassKey;
  name: string;
  color: string;
  pixels: number;
  ratio: number;
};

type SegmentationResult = {
  sourceUrl: string;
  sourceLabel: string;
  referenceMaskUrl: string;
  referenceOverlayUrl: string;
  projectMaskUrl: string;
  projectOverlayUrl: string;
  width: number;
  height: number;
  agreement: number;
  referenceSummary: ClassSummary[];
  projectSummary: ClassSummary[];
  canopyCover: number;
  builtUpShare: number;
  exposedSurface: number;
  waterShadowShare: number;
};

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; message: string };

/* ─────────────────── Constants ─────────────────── */

const CLASS_META: Array<{ id: ClassKey; name: string; color: [number, number, number] }> = [
  { id: 0, name: "Vegetation", color: [27, 128, 69] },
  { id: 1, name: "Sparse Vegetation", color: [166, 217, 106] },
  { id: 2, name: "Bare Soil / Rock", color: [217, 172, 84] },
  { id: 3, name: "Built-up / Urban", color: [120, 120, 120] },
  { id: 4, name: "Water / Shadow", color: [43, 131, 186] }
];

const SAMPLE_IMAGES = [
  {
    label: "Hasdeo Disturbance Window",
    url: "/api/asset?path=data/02_comparison_based_on_events/event_1/tiff_to_jpeg/ANN_Hasdeo_Full_2022.jpg"
  },
  {
    label: "Hasdeo Baseline Scene",
    url: "/api/asset?path=data/02_comparison_based_on_events/event_1/tiff_to_jpeg/MON_Hasdeo_North_2020_01_slowdown.jpg"
  },
  {
    label: "Kangaroo Island Recovery Window",
    url: "/api/asset?path=data/01_area_of_interest_selection_using_sampling/batch_3/kangaroo_island_black_summer/rgb_images/KI_2021-01-09_POSTFIRE_RECOVERY_RGB.png"
  }
];

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_MB = 30;

/* ─────────────────── Core rendering helpers ─────────────────── */

function renderMask(mask: Uint8Array, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  const image = ctx.createImageData(width, height);

  for (let index = 0; index < mask.length; index += 1) {
    const color = CLASS_META[mask[index]].color;
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function renderOverlay(source: ImageData, mask: Uint8Array, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  const image = ctx.createImageData(width, height);

  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const color = CLASS_META[mask[index]].color;
    image.data[offset] = Math.round(source.data[offset] * 0.58 + color[0] * 0.42);
    image.data[offset + 1] = Math.round(source.data[offset + 1] * 0.58 + color[1] * 0.42);
    image.data[offset + 2] = Math.round(source.data[offset + 2] * 0.58 + color[2] * 0.42);
    image.data[offset + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image. Check the file format or try another image."));
    img.src = url;
  });
}

async function runComparison(sourceUrl: string, sourceLabel: string): Promise<SegmentationResult> {
  const image = await loadImage(sourceUrl);
  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context unavailable.");

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./segmentation.worker.ts", import.meta.url));

    worker.onmessage = (event) => {
      const {
        referenceSmoothed,
        projectSmoothed,
        referenceSummary,
        projectSummary,
        canopyCover,
        builtUpShare,
        exposedSurface,
        waterShadowShare,
        agreement
      } = event.data;

      try {
        resolve({
          sourceUrl,
          sourceLabel,
          referenceMaskUrl: renderMask(referenceSmoothed, width, height),
          referenceOverlayUrl: renderOverlay(imageData, referenceSmoothed, width, height),
          projectMaskUrl: renderMask(projectSmoothed, width, height),
          projectOverlayUrl: renderOverlay(imageData, projectSmoothed, width, height),
          width,
          height,
          agreement,
          referenceSummary,
          projectSummary,
          canopyCover,
          builtUpShare,
          exposedSurface,
          waterShadowShare
        });
      } catch (err) {
        reject(err);
      } finally {
        worker.terminate();
      }
    };

    worker.onerror = (errorEvent) => {
      reject(new Error(errorEvent.message ?? "Worker crashed during segmentation."));
      worker.terminate();
    };

    const pixelData = new Uint8ClampedArray(imageData.data);
    worker.postMessage({ imageDataArray: pixelData, width, height }, [pixelData.buffer]);
  });
}

/* ─────────────────── Toast component ─────────────────── */

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") return <CheckCircle2 size={18} aria-hidden />;
  if (kind === "error") return <TriangleAlert size={18} aria-hidden />;
  return <ImagePlus size={18} aria-hidden />;
}

function ToastItem({
  toast,
  onDismiss
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 320);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const timer = setTimeout(dismiss, 4500);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`seg-toast seg-toast--${toast.kind}${exiting ? " seg-toast--exit" : ""}`}
    >
      <span className="seg-toast-icon">
        <ToastIcon kind={toast.kind} />
      </span>
      <div className="seg-toast-body">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button
        type="button"
        className="seg-toast-close"
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="seg-toast-stack" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/* ─────────────────── Summary bars ─────────────────── */

function SummaryBars({ title, summary }: { title: string; summary: ClassSummary[] }) {
  return (
    <div className="seg-summary">
      <div className="seg-summary-head">
        <strong>{title}</strong>
      </div>
      {summary.map((row) => (
        <div className="seg-bar-row" key={row.id}>
          <span>{row.name}</span>
          <strong>{(row.ratio * 100).toFixed(1)}%</strong>
          <div className="seg-bar-track">
            <i style={{ width: `${Math.max(2, row.ratio * 100)}%`, background: row.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── Main page ─────────────────── */

let toastCounter = 0;

export default function SegmentationLabPage() {
  const uploadUrlRef = useRef<string | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const [result, setResult] = useState<SegmentationResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* Toast helpers */
  const addToast = useCallback((kind: ToastKind, title: string, message: string) => {
    toastCounter += 1;
    const id = toastCounter;
    setToasts((prev) => [...prev, { id, kind, title, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* Scroll to results once they arrive */
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  /* Revoke object URL on unmount */
  useEffect(() => {
    return () => {
      if (uploadUrlRef.current) URL.revokeObjectURL(uploadUrlRef.current);
    };
  }, []);

  /* Initial sample load (silent – no toast) */
  useEffect(() => {
    startTransition(() => {
      void runComparison(SAMPLE_IMAGES[0].url, SAMPLE_IMAGES[0].label)
        .then(setResult)
        .catch(() => {/* silent initial load failure */});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSample(url: string, label: string) {
    addToast("info", "Loading scene", `Preparing "${label}" for segmentation…`);
    startTransition(() => {
      void runComparison(url, label)
        .then((res) => {
          setResult(res);
          addToast("success", "Segmentation complete", `"${label}" analysed — ${res.canopyCover.toFixed(1)}% canopy detected.`);
        })
        .catch((err: Error) => {
          addToast("error", "Segmentation failed", err.message);
        });
    });
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    /* Validate file type */
    if (!ACCEPTED_TYPES.includes(file.type)) {
      addToast("error", "Unsupported format", `"${file.name}" is not a PNG, JPEG, or WebP image.`);
      event.target.value = "";
      return;
    }

    /* Validate file size */
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      addToast("error", "File too large", `Maximum upload size is ${MAX_FILE_MB} MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      event.target.value = "";
      return;
    }

    if (uploadUrlRef.current) URL.revokeObjectURL(uploadUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    uploadUrlRef.current = objectUrl;

    addToast("info", "Image uploaded", `"${file.name}" received — starting segmentation on background thread…`);

    startTransition(() => {
      void runComparison(objectUrl, file.name)
        .then((res) => {
          setResult(res);
          addToast(
            "success",
            "Analysis ready",
            `"${file.name}" — ${res.canopyCover.toFixed(1)}% canopy · ${res.builtUpShare.toFixed(1)}% built-up · ${res.agreement.toFixed(1)}% engine agreement.`
          );
        })
        .catch((err: Error) => {
          addToast("error", "Upload processing failed", err.message);
        });
    });

    /* Reset input so the same file can be re-selected */
    event.target.value = "";
  }

  return (
    <main className="page segmentation-page">
      {/* ── Toast portal ── */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Hero ── */}
      <section className="seg-hero">
        <div>
          <span className="badge">Model comparison lab</span>
          <h1>Compare a reference segmenter against the Urban Leaf segmentation workflow.</h1>
          <p>
            Upload one image, run both engines on the same frame, and inspect masks, overlays, class ratios, and
            canopy-style indicators in one place.
          </p>
        </div>
        <div className="seg-actions">
          <label className="seg-upload" id="seg-upload-label">
            <ArrowUpFromLine size={18} aria-hidden />
            <span>Upload image</span>
            <input
              id="seg-upload-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUpload}
              aria-labelledby="seg-upload-label"
            />
          </label>
          <div className="seg-samples">
            {SAMPLE_IMAGES.map((item) => (
              <button
                key={item.label}
                type="button"
                id={`seg-sample-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => handleSample(item.url, item.label)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Info cards ── */}
      <section className="seg-note surface">
        <div className="seg-note-grid">
          <article>
            <Layers3 size={18} aria-hidden />
            <strong>Reference engine</strong>
            <p>Acts like the external tool baseline so we can visually benchmark class coverage and scene interpretation.</p>
          </article>
          <article>
            <SplitSquareVertical size={18} aria-hidden />
            <strong>Urban Leaf workflow</strong>
            <p>Uses the project class system and indicator extraction so the website can explain our scene understanding.</p>
          </article>
          <article>
            <Trees size={18} aria-hidden />
            <strong>Useful now</strong>
            <p>The UI contract is ready today and can later swap this project engine for the real checkpoint inference path.</p>
          </article>
        </div>
      </section>

      {/* ── Worker banner ── */}
      {isPending && (
        <section className="seg-worker-banner" aria-live="polite" aria-busy="true">
          <span className="seg-worker-spinner" aria-hidden="true" />
          <div>
            <strong>Web Worker running&nbsp;&mdash;&nbsp;background thread</strong>
            <p>Pixel classification and mask smoothing are running in a dedicated Worker thread. The UI stays fully responsive.</p>
          </div>
        </section>
      )}

      {/* ── Results ── */}
      <section
        className="seg-results-grid"
        ref={resultsRef}
        id="seg-results"
        aria-label="Segmentation results"
      >
        <article className="surface seg-panel">
          <div className="surface-head">
            <div>
              <h2>Input frame</h2>
              <p className="muted">{result?.sourceLabel ?? "Preparing sample image…"}</p>
            </div>
            <span className="badge">
              {isPending ? "Running" : result ? `${result.width} × ${result.height}` : "Idle"}
            </span>
          </div>

          {result ? (
            <img className="seg-image" src={result.sourceUrl} alt={result.sourceLabel} />
          ) : isPending ? (
            <div className="seg-skeleton">
              <div className="seg-skeleton-img" />
              <div className="seg-skeleton-lines"><span /><span /><span /></div>
            </div>
          ) : (
            <div className="seg-placeholder" />
          )}

          <div className="seg-kpis">
            <div>
              <span>Agreement</span>
              <strong>{result ? `${result.agreement.toFixed(1)}%` : "…"}</strong>
            </div>
            <div>
              <span>Canopy estimate</span>
              <strong>{result ? `${result.canopyCover.toFixed(1)}%` : "…"}</strong>
            </div>
            <div>
              <span>Water / shadow</span>
              <strong>{result ? `${result.waterShadowShare.toFixed(1)}%` : "…"}</strong>
            </div>
          </div>
        </article>

        <article className="surface seg-panel">
          <div className="surface-head">
            <div>
              <h2>Reference segmenter</h2>
              <p className="muted">Baseline output for side-by-side comparison.</p>
            </div>
          </div>
          {result ? (
            <img className="seg-image" src={result.referenceOverlayUrl} alt="Reference segmentation overlay" />
          ) : (
            <div className={isPending ? "seg-skeleton" : "seg-placeholder"}>
              {isPending && (
                <>
                  <div className="seg-skeleton-img" />
                  <div className="seg-skeleton-lines"><span /><span /><span /></div>
                </>
              )}
            </div>
          )}
          {result ? <img className="seg-image secondary" src={result.referenceMaskUrl} alt="Reference segmentation mask" /> : null}
          {result ? <SummaryBars title="Class distribution" summary={result.referenceSummary} /> : null}
        </article>

        <article className="surface seg-panel">
          <div className="surface-head">
            <div>
              <h2>Urban Leaf workflow</h2>
              <p className="muted">Project-oriented segmentation and indicator extraction.</p>
            </div>
            <span className="badge insight-badge">Website-ready</span>
          </div>
          {result ? (
            <img className="seg-image" src={result.projectOverlayUrl} alt="Project segmentation overlay" />
          ) : (
            <div className={isPending ? "seg-skeleton" : "seg-placeholder"}>
              {isPending && (
                <>
                  <div className="seg-skeleton-img" />
                  <div className="seg-skeleton-lines"><span /><span /><span /></div>
                </>
              )}
            </div>
          )}
          {result ? <img className="seg-image secondary" src={result.projectMaskUrl} alt="Project segmentation mask" /> : null}
          {result ? <SummaryBars title="Class distribution" summary={result.projectSummary} /> : null}
        </article>
      </section>

      {/* ── Derived indicators ── */}
      <section className="surface seg-metrics-surface" id="seg-indicators">
        <div className="surface-head">
          <div>
            <h2>Derived scene indicators</h2>
            <p className="muted">Quick signals we can surface beside segmentation output on the website.</p>
          </div>
        </div>
        <div className="seg-indicator-grid">
          <article>
            <span><Trees size={15} aria-hidden /> Canopy cover</span>
            <strong>{result ? `${result.canopyCover.toFixed(1)}%` : "…"}</strong>
            <p>Vegetation plus sparse vegetation share from the project segmentation.</p>
          </article>
          <article>
            <span><Layers3 size={15} aria-hidden /> Built-up share</span>
            <strong>{result ? `${result.builtUpShare.toFixed(1)}%` : "…"}</strong>
            <p>Urban or impervious class share inside the uploaded scene.</p>
          </article>
          <article>
            <span><SplitSquareVertical size={15} aria-hidden /> Exposed surface</span>
            <strong>{result ? `${result.exposedSurface.toFixed(1)}%` : "…"}</strong>
            <p>Bare soil plus built-up pixels, useful for disturbance-style interpretation.</p>
          </article>
          <article>
            <span><Waves size={15} aria-hidden /> Water / shadow</span>
            <strong>{result ? `${result.waterShadowShare.toFixed(1)}%` : "…"}</strong>
            <p>Low-light and water-like regions that influence scene readability.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
