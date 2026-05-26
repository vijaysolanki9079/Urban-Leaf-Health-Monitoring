import { promises as fs } from "fs";
import path from "path";
import { FEATURE_KEYS, type FeatureRecord, type ImageRecord, type RegionSummary } from "@/lib/shared";
export { FEATURE_KEYS } from "@/lib/shared";

const PROJECT_ROOT = process.cwd();
const FEATURE_CSV = path.join(
  PROJECT_ROOT,
  "data/02_comparison_based_on_events/event_1/csv_files/cleaned_images_features.csv"
);
const EVENT_IMAGE_DIR = path.join(
  PROJECT_ROOT,
  "data/02_comparison_based_on_events/event_1/tiff_to_jpeg"
);
const SAMPLE_ROOT = path.join(PROJECT_ROOT, "data/01_area_of_interest_selection_using_sampling");
const ASSET_ROOT = path.join(PROJECT_ROOT, "assets");
const MODEL_ARTIFACT_ROOTS = [
  path.join(PROJECT_ROOT, "results"),
  path.join(PROJECT_ROOT, "h100_config/results"),
  path.join(PROJECT_ROOT, "models"),
  path.join(PROJECT_ROOT, "h100_config/models")
];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...body] = rows;
  if (!headers) return [];
  return body.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() ?? ""]))
  );
}

function toNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDateFromName(filename: string): { date: string; year: number; month?: number } | null {
  const iso = filename.match(/(20\d{2}|19\d{2})[-_](\d{2})(?:[-_](\d{2}))?/);
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = iso[3] ? Number(iso[3]) : 1;
  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month
  };
}

function inferRegion(filename: string): string {
  if (filename.includes("Control_Forest")) return "control-forest";
  if (filename.includes("Kente_Extension")) return "kente-extension";
  if (filename.includes("PEKB_Core")) return "pekb-core";
  if (filename.includes("Hasdeo_North")) return "hasdeo-north";
  if (filename.includes("Hasdeo_Full") || filename.includes("Hasdeo_Arand")) return "hasdeo-full";
  if (filename.includes("Blue_Mts") || filename.includes("Sydney") || filename.includes("Penrith") || filename.includes("Warragamba")) {
    return "sydney-blue-mountains";
  }
  if (filename.includes("KI_")) return "kangaroo-island";
  return "hasdeo-full";
}

function inferPhase(filename: string, year: number): string {
  if (filename.includes("PREFIRE") || year <= 2017) return "baseline";
  if (filename.includes("DURING") || filename.includes("rapid_exp") || (year >= 2018 && year <= 2019)) return "disturbance";
  if (filename.includes("slowdown") || year === 2020 || year === 2021 || year === 2022) return "active-monitoring";
  if (filename.includes("POST") || filename.includes("renewed") || year >= 2023) return "recovery";
  return "monitoring";
}

async function walkFiles(dir: string, extensions: Set<string>): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkFiles(fullPath, extensions);
      return extensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
    })
  );
  return files.flat();
}

export async function getFeatures(): Promise<FeatureRecord[]> {
  const csv = await fs.readFile(FEATURE_CSV, "utf8");
  return parseCsv(csv)
    .map((row) => {
      const base: FeatureRecord = {
        id: row.id,
        lat: toNumber(row.lat) ?? 0,
        lon: toNumber(row.lon) ?? 0,
        period: row.period
      };
      for (const key of FEATURE_KEYS) {
        const value = toNumber(row[key]);
        if (value !== undefined) base[key] = value;
      }
      return base;
    })
    .filter((row) => row.period);
}

export async function getImages(): Promise<ImageRecord[]> {
  const imagePaths = [
    ...(await walkFiles(EVENT_IMAGE_DIR, new Set([".jpg", ".jpeg", ".png"]))),
    ...(await walkFiles(SAMPLE_ROOT, new Set([".jpg", ".jpeg", ".png"]))),
    ...(await walkFiles(ASSET_ROOT, new Set([".jpg", ".jpeg", ".png"])))
  ];

  return imagePaths
    .flatMap((filePath): ImageRecord[] => {
      const filename = path.basename(filePath);
      const parsed = parseDateFromName(filename);
      if (!parsed) return [];
      const region = inferRegion(filename);
      const image: ImageRecord = {
        id: Buffer.from(path.relative(PROJECT_ROOT, filePath)).toString("base64url"),
        region,
        date: parsed.date,
        year: parsed.year,
        phase: inferPhase(filename, parsed.year),
        source: filePath.startsWith(EVENT_IMAGE_DIR)
          ? "event_jpeg"
          : filePath.startsWith(ASSET_ROOT)
            ? "asset"
            : "sample_rgb",
        filename,
        path: path.relative(PROJECT_ROOT, filePath)
      };
      if (parsed.month !== undefined) image.month = parsed.month;
      return [image];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRegions(): Promise<RegionSummary[]> {
  const [images, features] = await Promise.all([getImages(), getFeatures()]);
  const ids = Array.from(new Set(images.map((image) => image.region)));
  if (!ids.includes("hasdeo-full")) ids.unshift("hasdeo-full");

  return ids.map((id) => {
    const regionImages = images.filter((image) => image.region === id);
    const dates = regionImages.map((image) => image.date).sort();
    return {
      id,
      label: id
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" "),
      imageCount: regionImages.length,
      featureCount: id.startsWith("hasdeo") ? features.length : 0,
      start: dates[0],
      end: dates[dates.length - 1]
    };
  });
}

export function filterFeatures(
  rows: FeatureRecord[],
  from: string,
  to: string
): FeatureRecord[] {
  return rows.filter((row) => row.period >= from && row.period <= to);
}

export function pickNearestImage(images: ImageRecord[], region: string, period: string): ImageRecord | undefined {
  const target = new Date(`${period.length === 4 ? `${period}-01` : period}-01`).getTime();
  const candidates = images.filter((image) => image.region === region || (region === "hasdeo-full" && image.region.startsWith("hasdeo")));
  return candidates
    .map((image) => ({ image, distance: Math.abs(new Date(image.date).getTime() - target) }))
    .sort((a, b) => a.distance - b.distance)[0]?.image;
}

export function safeAssetPath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.join(PROJECT_ROOT, normalized);
  const allowedRoots = [EVENT_IMAGE_DIR, SAMPLE_ROOT, ASSET_ROOT, ...MODEL_ARTIFACT_ROOTS].map((root) =>
    path.resolve(root)
  );
  return allowedRoots.some((root) => path.resolve(absolute).startsWith(root)) ? absolute : null;
}
