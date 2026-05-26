import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const ROOT = process.cwd();
const SEARCH_ROOTS = [
  path.join(ROOT, "results"),
  path.join(ROOT, "h100_config/results"),
  path.join(ROOT, "models"),
  path.join(ROOT, "h100_config/models")
];

export const dynamic = "force-dynamic";

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return [full];
    })
  );
  return nested.flat();
}

function rel(filePath: string) {
  return path.relative(ROOT, filePath);
}

export async function GET() {
  const roots = [];
  for (const root of SEARCH_ROOTS) {
    if (await exists(root)) roots.push(root);
  }

  const files = (await Promise.all(roots.map(walk))).flat();
  const modelPath = files.find((file) => /best_model\.pth$|\.pt$|\.ckpt$|\.keras$|\.h5$/i.test(file));
  const historyPath = files.find((file) => /training_history\.json$/i.test(file));
  const summaryFiles = files.filter((file) => /summary\.json$|inference_run_summary\.json$/i.test(file));
  const masks = files
    .filter((file) => /_mask\.png$/i.test(file))
    .map((file) => ({ name: path.basename(file), path: rel(file) }));
  const overlays = files
    .filter((file) => /_overlay\.png$/i.test(file))
    .map((file) => ({ name: path.basename(file), path: rel(file) }));

  const summaries = [];
  for (const file of summaryFiles) {
    try {
      const parsed = JSON.parse(await fs.readFile(file, "utf8"));
      const values = Object.values(parsed);
      const firstValue = values[0] as unknown;
      const data =
        firstValue &&
        typeof firstValue === "object" &&
        "ratio" in firstValue &&
        "pixels" in firstValue
          ? parsed
          : firstValue && typeof firstValue === "object"
            ? firstValue
            : parsed;
      summaries.push({
        name: path.basename(file),
        path: rel(file),
        data
      });
    } catch {
      // Ignore malformed artifacts; the UI should reflect usable results only.
    }
  }

  let trainingHistory = null;
  if (historyPath) {
    try {
      trainingHistory = JSON.parse(await fs.readFile(historyPath, "utf8"));
    } catch {
      trainingHistory = null;
    }
  }

  return NextResponse.json({
    hasModel: Boolean(modelPath),
    hasInference: summaries.length > 0 || masks.length > 0 || overlays.length > 0,
    modelPath: modelPath ? rel(modelPath) : null,
    trainingHistory,
    summaries,
    masks,
    overlays,
    expectedArtifacts: [
      "trained checkpoint: results/best_model.pth or h100_config/results/best_model.pth",
      "inference masks: *_mask.png",
      "visual overlays: *_overlay.png",
      "class summaries: *summary.json"
    ],
    runbook: {
      script: "h100_config/06_predict_visualize.py",
      purpose: "Batch inference over curated satellite rasters, then publish masks, overlays, and class ratios to the dashboard.",
      example:
        "python h100_config/06_predict_visualize.py --checkpoint results/best_model.pth --input data/<scene>.npy --output results/inference"
    }
  });
}
