"use client";

import { ChangeEvent, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpFromLine, Layers3, SplitSquareVertical, Trees, Waves } from "lucide-react";

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

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }

  return {
    h: (h * 60 + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

function classifyReference(r: number, g: number, b: number): ClassKey {
  const { h, s, v } = rgbToHsv(r, g, b);
  const exg = (2 * g - r - b) / 255;
  const blueDominance = (b - Math.max(r, g)) / 255;
  const warmth = (r - b) / 255;

  if (v < 0.2 || (blueDominance > 0.08 && s < 0.45)) return 4;
  if (exg > 0.16 && h >= 65 && h <= 165) return v > 0.46 ? 0 : 1;
  if (s < 0.16 && v > 0.42) return 3;
  if (warmth > 0.1 && v > 0.35) return 2;
  if (h >= 75 && h <= 150) return 1;
  return v > 0.58 ? 3 : 2;
}

function classifyProject(r: number, g: number, b: number): ClassKey {
  const { h, s, v } = rgbToHsv(r, g, b);
  const greenBoost = (g - (r + b) / 2) / 255;
  const dryness = (r - g) / 255 + (Math.abs(r - b) / 255) * 0.4;
  const waterCue = (b - r) / 255;
  const brightNeutral = s < 0.14 && v > 0.48;

  if (v < 0.18 || (waterCue > 0.09 && s < 0.52)) return 4;
  if (greenBoost > 0.12 && h >= 68 && h <= 150) return v > 0.42 ? 0 : 1;
  if (dryness > 0.14 && v > 0.28) return 2;
  if (brightNeutral || (s < 0.22 && v > 0.36)) return 3;
  if (h >= 70 && h <= 145) return 1;
  return v > 0.52 ? 3 : 2;
}

function smoothMask(mask: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(mask);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const counts = [0, 0, 0, 0, 0];
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          counts[mask[(y + ky) * width + (x + kx)]] += 1;
        }
      }
      let best: ClassKey = 0;
      let bestCount = -1;
      for (let index = 0; index < counts.length; index += 1) {
        if (counts[index] > bestCount) {
          best = index as ClassKey;
          bestCount = counts[index];
        }
      }
      output[y * width + x] = best;
    }
  }
  return output;
}

function summarizeMask(mask: Uint8Array): ClassSummary[] {
  const total = mask.length || 1;
  return CLASS_META.map((item) => {
    let pixels = 0;
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] === item.id) pixels += 1;
    }
    return {
      id: item.id,
      name: item.name,
      color: `rgb(${item.color.join(", ")})`,
      pixels,
      ratio: pixels / total
    };
  });
}

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
    img.onerror = () => reject(new Error("Unable to load image."));
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
  const referenceMask = new Uint8Array(width * height);
  const projectMask = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const r = imageData.data[offset];
    const g = imageData.data[offset + 1];
    const b = imageData.data[offset + 2];
    referenceMask[index] = classifyReference(r, g, b);
    projectMask[index] = classifyProject(r, g, b);
  }

  const referenceSmoothed = smoothMask(referenceMask, width, height);
  const projectSmoothed = smoothMask(projectMask, width, height);
  let agreement = 0;

  for (let index = 0; index < referenceSmoothed.length; index += 1) {
    if (referenceSmoothed[index] === projectSmoothed[index]) agreement += 1;
  }

  const referenceSummary = summarizeMask(referenceSmoothed);
  const projectSummary = summarizeMask(projectSmoothed);
  const canopyCover = clamp01(projectSummary[0].ratio + projectSummary[1].ratio) * 100;
  const builtUpShare = projectSummary[3].ratio * 100;
  const exposedSurface = (projectSummary[2].ratio + projectSummary[3].ratio) * 100;
  const waterShadowShare = projectSummary[4].ratio * 100;

  return {
    sourceUrl,
    sourceLabel,
    referenceMaskUrl: renderMask(referenceSmoothed, width, height),
    referenceOverlayUrl: renderOverlay(imageData, referenceSmoothed, width, height),
    projectMaskUrl: renderMask(projectSmoothed, width, height),
    projectOverlayUrl: renderOverlay(imageData, projectSmoothed, width, height),
    width,
    height,
    agreement: (agreement / referenceSmoothed.length) * 100,
    referenceSummary,
    projectSummary,
    canopyCover,
    builtUpShare,
    exposedSurface,
    waterShadowShare
  };
}

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

export default function SegmentationLabPage() {
  const uploadUrlRef = useRef<string | null>(null);
  const [result, setResult] = useState<SegmentationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void runComparison(SAMPLE_IMAGES[0].url, SAMPLE_IMAGES[0].label)
        .then(setResult)
        .catch((err: Error) => setError(err.message));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (uploadUrlRef.current) URL.revokeObjectURL(uploadUrlRef.current);
    };
  }, []);

  function handleSample(url: string, label: string) {
    setError(null);
    startTransition(() => {
      void runComparison(url, label)
        .then(setResult)
        .catch((err: Error) => setError(err.message));
    });
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (uploadUrlRef.current) URL.revokeObjectURL(uploadUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    uploadUrlRef.current = objectUrl;
    setError(null);
    startTransition(() => {
      void runComparison(objectUrl, file.name)
        .then(setResult)
        .catch((err: Error) => setError(err.message));
    });
  }

  return (
    <main className="page segmentation-page">
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
          <label className="seg-upload">
            <ArrowUpFromLine size={18} aria-hidden />
            <span>Upload image</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} />
          </label>
          <div className="seg-samples">
            {SAMPLE_IMAGES.map((item) => (
              <button key={item.label} type="button" onClick={() => handleSample(item.url, item.label)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

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

      {error ? <section className="surface model-empty"><strong>{error}</strong></section> : null}

      <section className="seg-results-grid">
        <article className="surface seg-panel">
          <div className="surface-head">
            <div>
              <h2>Input frame</h2>
              <p className="muted">{result?.sourceLabel ?? "Preparing sample image..."}</p>
            </div>
            <span className="badge">{isPending ? "Running" : result ? `${result.width} x ${result.height}` : "Idle"}</span>
          </div>
          {result ? <img className="seg-image" src={result.sourceUrl} alt={result.sourceLabel} /> : <div className="seg-placeholder" />}
          <div className="seg-kpis">
            <div>
              <span>Agreement</span>
              <strong>{result ? `${result.agreement.toFixed(1)}%` : "..."}</strong>
            </div>
            <div>
              <span>Canopy estimate</span>
              <strong>{result ? `${result.canopyCover.toFixed(1)}%` : "..."}</strong>
            </div>
            <div>
              <span>Water / shadow</span>
              <strong>{result ? `${result.waterShadowShare.toFixed(1)}%` : "..."}</strong>
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
          {result ? <img className="seg-image" src={result.referenceOverlayUrl} alt="Reference segmentation overlay" /> : <div className="seg-placeholder" />}
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
          {result ? <img className="seg-image" src={result.projectOverlayUrl} alt="Project segmentation overlay" /> : <div className="seg-placeholder" />}
          {result ? <img className="seg-image secondary" src={result.projectMaskUrl} alt="Project segmentation mask" /> : null}
          {result ? <SummaryBars title="Class distribution" summary={result.projectSummary} /> : null}
        </article>
      </section>

      <section className="surface seg-metrics-surface">
        <div className="surface-head">
          <div>
            <h2>Derived scene indicators</h2>
            <p className="muted">Quick signals we can surface beside segmentation output on the website.</p>
          </div>
        </div>
        <div className="seg-indicator-grid">
          <article>
            <span><Trees size={15} aria-hidden /> Canopy cover</span>
            <strong>{result ? `${result.canopyCover.toFixed(1)}%` : "..."}</strong>
            <p>Vegetation plus sparse vegetation share from the project segmentation.</p>
          </article>
          <article>
            <span><Layers3 size={15} aria-hidden /> Built-up share</span>
            <strong>{result ? `${result.builtUpShare.toFixed(1)}%` : "..."}</strong>
            <p>Urban or impervious class share inside the uploaded scene.</p>
          </article>
          <article>
            <span><SplitSquareVertical size={15} aria-hidden /> Exposed surface</span>
            <strong>{result ? `${result.exposedSurface.toFixed(1)}%` : "..."}</strong>
            <p>Bare soil plus built-up pixels, useful for disturbance-style interpretation.</p>
          </article>
          <article>
            <span><Waves size={15} aria-hidden /> Water / shadow</span>
            <strong>{result ? `${result.waterShadowShare.toFixed(1)}%` : "..."}</strong>
            <p>Low-light and water-like regions that influence scene readability.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
