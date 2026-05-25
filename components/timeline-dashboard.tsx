"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Database,
  GitBranch,
  Image as ImageIcon,
  MapPinned,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  SquareStack,
  Thermometer,
  Trees,
  Waves
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FeatureKey, FeatureRecord, ImageRecord, RegionSummary } from "@/lib/shared";
import { FEATURE_LABELS } from "@/lib/shared";

type CompareResponse = {
  region: string;
  from: string;
  to: string;
  feature: FeatureKey;
  before?: FeatureRecord;
  after?: FeatureRecord;
  delta: number | null;
  beforeImage?: ImageRecord;
  afterImage?: ImageRecord;
  timeline: FeatureRecord[];
};

type Props = {
  regions: RegionSummary[];
  featureKeys: FeatureKey[];
};

const FEATURE_GROUPS: Array<{ title: string; icon: LucideIcon; features: FeatureKey[] }> = [
  { title: "Vegetation", icon: Trees, features: ["NDVI", "EVI", "SAVI", "LAI", "GCI", "ARVI", "canopy_cover_pct"] },
  { title: "Water", icon: Waves, features: ["NDWI", "MNDWI"] },
  { title: "Urban and soil", icon: SquareStack, features: ["NDBI", "BSI"] },
  { title: "Thermal", icon: Thermometer, features: ["LST_celsius"] }
];

const FEATURE_COLORS: Record<FeatureKey, string> = {
  NDVI: "#1f7a4c",
  NDWI: "#27739b",
  MNDWI: "#48a2b8",
  NDBI: "#9b5c2e",
  EVI: "#54a36f",
  SAVI: "#7fb069",
  LAI: "#2f8f62",
  GCI: "#8fcf5f",
  ARVI: "#3f9f77",
  BSI: "#d39132",
  LST_celsius: "#d96a4e",
  canopy_cover_pct: "#6a9f58"
};

type ModelResults = {
  hasModel: boolean;
  hasInference: boolean;
  modelPath?: string;
  trainingHistory?: { epoch: number; val_iou?: number; val_acc?: number; train_loss?: number; val_loss?: number }[];
  summaries: Array<{ name: string; path: string; data: Record<string, { name: string; pixels: number; ratio: number }> }>;
  masks: Array<{ name: string; path: string }>;
  overlays: Array<{ name: string; path: string }>;
};

function assetUrl(image?: ImageRecord) {
  return image ? `/api/asset?path=${encodeURIComponent(image.path)}` : "";
}

function formatValue(value?: number, digits = 3) {
  return value === undefined || Number.isNaN(value) ? "n/a" : value.toFixed(digits);
}

function featureTone(feature: FeatureKey, delta: number | null) {
  if (delta === null) return "No comparable values available.";
  const direction = delta >= 0 ? "increased" : "decreased";
  if (feature === "NDVI" || feature === "EVI" || feature === "SAVI" || feature === "GCI") {
    return delta >= 0
      ? `Vegetation signal ${direction}; this points to recovery or denser canopy.`
      : `Vegetation signal ${direction}; this supports degradation or canopy loss.`;
  }
  if (feature === "BSI" || feature === "NDBI" || feature === "LST_celsius") {
    return delta >= 0
      ? `${FEATURE_LABELS[feature]} ${direction}; this can indicate exposed land, heat, or built-up pressure.`
      : `${FEATURE_LABELS[feature]} ${direction}; this can indicate reduced disturbance pressure.`;
  }
  return `${FEATURE_LABELS[feature]} ${direction} across the selected window.`;
}

function Chart({ rows, feature }: { rows: FeatureRecord[]; feature: FeatureKey }) {
  const points = useMemo(() => {
    const values = rows
      .map((row) => ({ period: row.period, value: row[feature] }))
      .filter((row): row is { period: string; value: number } => typeof row.value === "number");
    const min = Math.min(...values.map((row) => row.value));
    const max = Math.max(...values.map((row) => row.value));
    const range = max - min || 1;
    return values.map((row, index) => ({
      ...row,
      x: values.length === 1 ? 40 : 42 + (index / (values.length - 1)) * 716,
      y: 250 - ((row.value - min) / range) * 190,
      min,
      max
    }));
  }, [feature, rows]);

  if (!points.length) {
    return <div className="status-line">No values available for the selected feature and range.</div>;
  }

  const pathData = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <svg className="chart" viewBox="0 0 800 300" role="img" aria-label={`${feature} timeline chart`}>
      <line x1="42" y1="250" x2="758" y2="250" stroke="#cdd6ca" />
      <line x1="42" y1="58" x2="42" y2="250" stroke="#cdd6ca" />
      {[0, 1, 2, 3].map((tick) => (
        <line key={tick} x1="42" y1={250 - tick * 48} x2="758" y2={250 - tick * 48} stroke="#edf1ea" />
      ))}
      <path d={pathData} fill="none" stroke="#25633f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => (
        <circle key={point.period} cx={point.x} cy={point.y} r="4" fill="#b77226" />
      ))}
      <text x="42" y="38">{formatValue(first.max)}</text>
      <text x="42" y="274">{first.period}</text>
      <text x="704" y="274">{last.period}</text>
      <text x="710" y="38">{formatValue(first.min)}</text>
    </svg>
  );
}

function MiniFeatureChart({ rows, feature }: { rows: FeatureRecord[]; feature: FeatureKey }) {
  const points = useMemo(() => {
    const values = rows
      .map((row) => ({ period: row.period, value: row[feature] }))
      .filter((row): row is { period: string; value: number } => typeof row.value === "number");
    if (!values.length) return [];
    const min = Math.min(...values.map((row) => row.value));
    const max = Math.max(...values.map((row) => row.value));
    const range = max - min || 1;
    return values.map((row, index) => ({
      ...row,
      x: values.length === 1 ? 6 : 6 + (index / (values.length - 1)) * 188,
      y: 72 - ((row.value - min) / range) * 54,
      min,
      max
    }));
  }, [feature, rows]);

  if (!points.length) return <div className="mini-empty">No data</div>;
  const pathData = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.value - first.value;

  return (
    <article className="mini-feature-card">
      <div className="mini-feature-head">
        <div>
          <strong>{feature}</strong>
          <span>{FEATURE_LABELS[feature]}</span>
        </div>
        <em className={delta < 0 ? "negative" : "positive"}>{delta >= 0 ? "+" : ""}{delta.toFixed(2)}</em>
      </div>
      <svg viewBox="0 0 200 84" aria-label={`${feature} mini chart`}>
        <path d="M 6 72 H 194" stroke="#e0e6e0" />
        <path d={pathData} fill="none" stroke={FEATURE_COLORS[feature]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[0].x} cy={points[0].y} r="3" fill={FEATURE_COLORS[feature]} />
        <circle cx={last.x} cy={last.y} r="3" fill={FEATURE_COLORS[feature]} />
      </svg>
    </article>
  );
}

function ModelResultsPanel({ modelResults }: { modelResults: ModelResults | null }) {
  const latestSummary = modelResults?.summaries[0];
  return (
    <section className="surface model-surface">
      <div className="surface-head">
        <div>
          <h2>Model output lane</h2>
          <p className="muted">Segmentation masks and class ratios appear here after the trained model runs inference.</p>
        </div>
        <span className={modelResults?.hasInference ? "badge success-badge" : "badge warning-badge"}>
          {modelResults?.hasInference ? "Inference ready" : "Awaiting inference"}
        </span>
      </div>

      {modelResults?.hasInference && latestSummary ? (
        <div className="model-grid">
          <div className="model-preview">
            {modelResults.overlays[0] || modelResults.masks[0] ? (
              <Image
                src={`/api/asset?path=${encodeURIComponent((modelResults.overlays[0] ?? modelResults.masks[0]).path)}`}
                alt="Model segmentation output"
                width={900}
                height={560}
                unoptimized
              />
            ) : null}
          </div>
          <div className="model-classes">
            {Object.entries(latestSummary.data).map(([key, value]) => (
              <div key={key} className="class-row">
                <span>{value.name}</span>
                <strong>{(value.ratio * 100).toFixed(1)}%</strong>
                <div>
                  <i style={{ width: `${Math.max(2, value.ratio * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="model-empty">
          <GitBranch size={28} aria-hidden />
          <div>
            <strong>No model inference results found in this repo yet.</strong>
            <p>
              The current graphs use GEE/CSV feature data. To show model working behind the website, run
              <code> h100_config/06_predict_visualize.py </code>
              with a trained checkpoint. Its masks, overlays, and summaries will be picked up here.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default function TimelineDashboard({ regions, featureKeys }: Props) {
  const defaultRegion = regions.find((item) => item.id === "hasdeo-full")?.id ?? regions[0]?.id ?? "hasdeo-full";
  const [region, setRegion] = useState(defaultRegion);
  const [feature, setFeature] = useState<FeatureKey>("NDVI");
  const [from, setFrom] = useState("2018-01");
  const [to, setTo] = useState("2024-12");
  const [data, setData] = useState<CompareResponse | null>(null);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadComparison(overrides?: Partial<{ region: string; feature: FeatureKey; from: string; to: string }>) {
    setLoading(true);
    const nextRegion = overrides?.region ?? region;
    const nextFeature = overrides?.feature ?? feature;
    const nextFrom = overrides?.from ?? from;
    const nextTo = overrides?.to ?? to;
    const params = new URLSearchParams({ region: nextRegion, feature: nextFeature, from: nextFrom, to: nextTo });
    const response = await fetch(`/api/compare?${params.toString()}`);
    setData(await response.json());
    setLoading(false);
  }

  useEffect(() => {
    void loadComparison();
    fetch("/api/model-results")
      .then((response) => response.json())
      .then(setModelResults)
      .catch(() => setModelResults(null));
    // Initial load only; form changes run through explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beforeValue = data?.before?.[feature];
  const afterValue = data?.after?.[feature];
  const delta = data?.delta ?? null;
  const selectedRegion = regions.find((item) => item.id === region);
  const deltaDirection = delta === null ? "neutral" : delta < 0 ? "down" : "up";
  const changePct =
    beforeValue !== undefined && afterValue !== undefined && beforeValue !== 0
      ? ((afterValue - beforeValue) / Math.abs(beforeValue)) * 100
      : null;

  return (
    <main className="page">
      <section className="workspace-head">
        <div className="hero-copy">
          <span className="eyebrow premium-eyebrow">Remote sensing intelligence</span>
          <h1>Urban leaf health, mapped across time.</h1>
          <p>
            A premium monitoring workspace for comparing curated satellite imagery, vegetation indices, and
            disturbance signals across user-selected timelines.
          </p>
          <div className="hero-actions">
            <button className="btn hero-btn" onClick={() => void loadComparison()}>
              <Search size={17} aria-hidden />
              Run analysis
            </button>
            <span className="hero-proof">
              <Sparkles size={15} aria-hidden />
              Hasdeo, Sydney fringe, Kangaroo Island
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Satellite monitoring preview">
          <div className="hero-image hero-image-main" />
          <div className="hero-image hero-image-small one" />
          <div className="hero-image hero-image-small two" />
          <div className="hero-glass">
            <span>Current signal</span>
            <strong>{feature}</strong>
            <small>{featureTone(feature, delta)}</small>
          </div>
        </div>
        <div className="head-metrics" aria-label="Dataset summary">
          <div className="metric-tile">
            <Database size={18} aria-hidden />
            <span>Feature rows</span>
            <strong>{selectedRegion?.featureCount ?? 0}</strong>
          </div>
          <div className="metric-tile">
            <ImageIcon size={18} aria-hidden />
            <span>Curated imagery</span>
            <strong>{selectedRegion?.imageCount ?? 0}</strong>
          </div>
          <div className="metric-tile">
            <MapPinned size={18} aria-hidden />
            <span>Active region</span>
            <strong>{selectedRegion?.label ?? "Hasdeo Full"}</strong>
          </div>
        </div>
      </section>

      <div className="tool-grid">
        <aside className="sidebar">
          <div className="sidebar-title">
            <SlidersHorizontal size={18} aria-hidden />
            <div>
              <h2>Query controls</h2>
              <p>Region, feature, and month range</p>
            </div>
          </div>

          <div className="control">
            <label htmlFor="region">Region</label>
            <select id="region" value={region} onChange={(event) => setRegion(event.target.value)}>
              {regions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.imageCount})
                </option>
              ))}
            </select>
          </div>

          <div className="control">
            <label htmlFor="feature">Feature</label>
            <select id="feature" value={feature} onChange={(event) => setFeature(event.target.value as FeatureKey)}>
              {featureKeys.map((key) => (
                <option key={key} value={key}>
                  {key} - {FEATURE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="control">
            <label htmlFor="from">From month</label>
            <input id="from" type="month" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>

          <div className="control">
            <label htmlFor="to">To month</label>
            <input id="to" type="month" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>

          <div className="button-row">
            <button className="btn primary" onClick={() => void loadComparison()}>
              <Search size={17} aria-hidden />
              Compare
            </button>
            <button
              className="btn"
              onClick={() => {
                const preset = { region: "hasdeo-full", feature: "NDVI" as FeatureKey, from: "2022-01", to: "2022-04" };
                setRegion(preset.region);
                setFeature(preset.feature);
                setFrom(preset.from);
                setTo(preset.to);
                void loadComparison(preset);
              }}
            >
              <CalendarRange size={17} aria-hidden />
              Event
            </button>
          </div>

          <div className="status-line">
            <RefreshCcw size={15} aria-hidden />
            {loading ? "Loading project data..." : `${data?.timeline.length ?? 0} feature records in range`}
          </div>

          <div className="preset-panel">
            <span className="eyebrow">Fast windows</span>
            <button
              type="button"
              onClick={() => {
                const preset = { region: "hasdeo-full", feature: "BSI" as FeatureKey, from: "2022-01", to: "2022-04" };
                setRegion(preset.region);
                setFeature(preset.feature);
                setFrom(preset.from);
                setTo(preset.to);
                void loadComparison(preset);
              }}
            >
              Hasdeo exposed soil
            </button>
            <button
              type="button"
              onClick={() => {
                const preset = { region: "hasdeo-full", feature: "LST_celsius" as FeatureKey, from: "2022-01", to: "2022-04" };
                setRegion(preset.region);
                setFeature(preset.feature);
                setFrom(preset.from);
                setTo(preset.to);
                void loadComparison(preset);
              }}
            >
              Heat stress check
            </button>
          </div>
        </aside>

        <section className="content">
          <div className="metrics">
            <div className="stat accent-green">
              <span><Activity size={15} aria-hidden /> Before</span>
              <strong>{formatValue(beforeValue)}</strong>
              <small>{data?.before?.period ?? from}</small>
            </div>
            <div className="stat accent-blue">
              <span><Activity size={15} aria-hidden /> After</span>
              <strong>{formatValue(afterValue)}</strong>
              <small>{data?.after?.period ?? to}</small>
            </div>
            <div className={`stat accent-${deltaDirection}`}>
              <span>{delta !== null && delta < 0 ? <ArrowDownRight size={15} aria-hidden /> : <ArrowUpRight size={15} aria-hidden />} Delta</span>
              <strong>
                {delta === null ? "n/a" : `${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`}
              </strong>
              <small>{changePct === null ? FEATURE_LABELS[feature] : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% vs start`}</small>
            </div>
            <div className="stat accent-amber">
              <span><MapPinned size={15} aria-hidden /> Signal</span>
              <strong>{feature}</strong>
              <small>{featureTone(feature, delta)}</small>
            </div>
          </div>

          <section className="surface chart-surface">
            <div className="surface-head">
              <div>
                <h2>{feature} feature timeline</h2>
                <p className="muted">{FEATURE_LABELS[feature]} from {from} to {to}</p>
              </div>
              <div className="badge-row">
                <span className="badge">{selectedRegion?.label ?? region}</span>
                <span className="badge muted-badge">{data?.timeline.length ?? 0} points</span>
              </div>
            </div>
            <Chart rows={data?.timeline ?? []} feature={feature} />
          </section>

          <section className="surface">
            <div className="surface-head">
              <div>
                <h2>All factor signals</h2>
                <p className="muted">Vegetation, canopy, water, soil, urban, and heat features from the same API response.</p>
              </div>
            </div>
            <div className="factor-groups">
              {FEATURE_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <div className="factor-group" key={group.title}>
                    <div className="factor-group-head">
                      <Icon size={17} aria-hidden />
                      <strong>{group.title}</strong>
                    </div>
                    <div className="mini-feature-grid">
                      {group.features.map((item) => (
                        <MiniFeatureChart key={item} rows={data?.timeline ?? []} feature={item} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <ModelResultsPanel modelResults={modelResults} />

          <section className="surface">
            <div className="surface-head">
              <div>
                <h2>Image comparison</h2>
                <p className="muted">Nearest curated imagery for the selected start and end points.</p>
              </div>
            </div>
            <div className="image-grid">
              <article className="image-shell">
                <header>
                  <span className="image-label">Before</span>
                  <strong>{data?.beforeImage?.date ?? from}</strong>
                </header>
                {data?.beforeImage ? (
                  <Image
                    src={assetUrl(data.beforeImage)}
                    alt={data.beforeImage.filename}
                    width={900}
                    height={560}
                    unoptimized
                  />
                ) : null}
                <footer>{data?.beforeImage?.filename ?? "No matching image"}</footer>
              </article>
              <article className="image-shell">
                <header>
                  <span className="image-label">After</span>
                  <strong>{data?.afterImage?.date ?? to}</strong>
                </header>
                {data?.afterImage ? (
                  <Image
                    src={assetUrl(data.afterImage)}
                    alt={data.afterImage.filename}
                    width={900}
                    height={560}
                    unoptimized
                  />
                ) : null}
                <footer>{data?.afterImage?.filename ?? "No matching image"}</footer>
              </article>
            </div>
          </section>

          <section className="surface">
            <div className="surface-head">
              <div>
                <h2>Feature details</h2>
                <p className="muted">Monthly records returned by the feature API.</p>
              </div>
            </div>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>NDVI</th>
                    <th>EVI</th>
                    <th>SAVI</th>
                    <th>BSI</th>
                    <th>NDBI</th>
                    <th>LST</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.timeline ?? []).slice(-18).map((row) => (
                    <tr key={row.period}>
                      <td>{row.period}</td>
                      <td>{formatValue(row.NDVI)}</td>
                      <td>{formatValue(row.EVI)}</td>
                      <td>{formatValue(row.SAVI)}</td>
                      <td>{formatValue(row.BSI)}</td>
                      <td>{formatValue(row.NDBI)}</td>
                      <td>{formatValue(row.LST_celsius, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
