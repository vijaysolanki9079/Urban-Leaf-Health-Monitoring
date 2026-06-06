"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  Compass,
  FileText,
  Flame,
  HelpCircle,
  Info,
  Layers3,
  Leaf,
  RefreshCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  Trash2,
  Trees,
  Waves,
  Zap
} from "lucide-react";

type CellType =
  | "dense-forest"
  | "sparse-forest"
  | "grassland"
  | "water"
  | "disturbed-soil"
  | "residential"
  | "industrial"
  | "green-highway";

interface Cell {
  id: number;
  row: number;
  col: number;
  type: CellType;
  initialType: CellType;
}

interface CellTypeMeta {
  type: CellType;
  label: string;
  color: string;
  bgClass: string;
  canopy: number;
  builtUp: number;
  bareSoil: number;
  lstDelta: number;
  description: string;
}

const CELL_META: Record<CellType, CellTypeMeta> = {
  "dense-forest": {
    type: "dense-forest",
    label: "Dense Forest",
    color: "#163a28",
    bgClass: "cell-dense-forest",
    canopy: 100,
    builtUp: 0,
    bareSoil: 0,
    lstDelta: -2.0,
    description: "Highly protected forest core with closed canopy."
  },
  "sparse-forest": {
    type: "sparse-forest",
    label: "Sparse Forest",
    color: "#54a36f",
    bgClass: "cell-sparse-forest",
    canopy: 50,
    builtUp: 0,
    bareSoil: 10,
    lstDelta: -0.8,
    description: "Fragmented or regenerating woodland with open canopy."
  },
  grassland: {
    type: "grassland",
    label: "Grassland/Shrub",
    color: "#a4bfa7",
    bgClass: "cell-grassland",
    canopy: 15,
    builtUp: 0,
    bareSoil: 15,
    lstDelta: 0.0,
    description: "Open fields, natural shrublands, or grazing pastures."
  },
  water: {
    type: "water",
    label: "Water Body",
    color: "#27739b",
    bgClass: "cell-water",
    canopy: 0,
    builtUp: 0,
    bareSoil: 0,
    lstDelta: -1.5,
    description: "Natural streams, lakes, or drainage basins."
  },
  "disturbed-soil": {
    type: "disturbed-soil",
    label: "Disturbed Soil",
    color: "#b08765",
    bgClass: "cell-disturbed-soil",
    canopy: 0,
    builtUp: 0,
    bareSoil: 80,
    lstDelta: 1.0,
    description: "Cleared ground, quarries, or exposed topsoil."
  },
  residential: {
    type: "residential",
    label: "Residential Zone",
    color: "#e59d3d",
    bgClass: "cell-residential",
    canopy: 10,
    builtUp: 70,
    bareSoil: 20,
    lstDelta: 2.5,
    description: "Housing settlements, public squares, and gardens."
  },
  industrial: {
    type: "industrial",
    label: "Industrial/Mining",
    color: "#a53e32",
    bgClass: "cell-industrial",
    canopy: 0,
    builtUp: 95,
    bareSoil: 5,
    lstDelta: 4.5,
    description: "Concrete plants, mining pits, or logistics blocks."
  },
  "green-highway": {
    type: "green-highway",
    label: "Green Infrastructure",
    color: "#5c7d8c",
    bgClass: "cell-green-highway",
    canopy: 25,
    builtUp: 55,
    bareSoil: 20,
    lstDelta: 0.8,
    description: "Roadways built with wildlife underpasses and tree verges."
  }
};

const GRID_SIZE = 10;

function createNaturalGrid(): Cell[] {
  const grid: Cell[] = [];
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const id = r * GRID_SIZE + c;
      let type: CellType = "grassland";

      // A diagonal river flowing from bottom-left to top-right (col + row === 9)
      const isWater = r + c === 9 || (r === 8 && c === 0) || (r === 0 && c === 8);
      
      // Forest core centered around (3,3) to (6,6)
      const isCore = r >= 2 && r <= 6 && c >= 2 && c <= 6;
      const isBuffer = r >= 1 && r <= 7 && c >= 1 && c <= 7;

      if (isWater) {
        type = "water";
      } else if (isCore) {
        type = "dense-forest";
      } else if (isBuffer) {
        type = "sparse-forest";
      }

      grid.push({
        id,
        row: r,
        col: c,
        type,
        initialType: type
      });
    }
  }
  return grid;
}

export default function PlanningSandbox() {
  const [grid, setGrid] = useState<Cell[]>(() => createNaturalGrid());
  const [selectedTool, setSelectedTool] = useState<CellType | "clear">("residential");
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Policy Toggles
  const [policyWildlife, setPolicyWildlife] = useState(false);
  const [policyGreenRoofs, setPolicyGreenRoofs] = useState(false);
  const [policyDrainage, setPolicyDrainage] = useState(false);

  const initialStats = useMemo(() => {
    let totalCanopy = 0;
    let totalBareSoil = 0;
    let totalBuiltUp = 0;

    for (const cell of grid) {
      const meta = CELL_META[cell.initialType];
      totalCanopy += meta.canopy;
      totalBareSoil += meta.bareSoil;
      totalBuiltUp += meta.builtUp;
    }

    return {
      canopy: totalCanopy / GRID_SIZE ** 2,
      bareSoil: totalBareSoil / GRID_SIZE ** 2,
      builtUp: totalBuiltUp / GRID_SIZE ** 2
    };
  }, [grid]);

  // Compute live scores and components
  const simulation = useMemo(() => {
    let currentCanopy = 0;
    let currentBareSoil = 0;
    let currentBuiltUp = 0;
    let baseLst = 0;
    let forestCount = 0;
    
    // Count of placed elements
    let residentialCount = 0;
    let industrialCount = 0;
    let roadCount = 0;

    for (const cell of grid) {
      const meta = CELL_META[cell.type];
      
      currentCanopy += meta.canopy;
      currentBareSoil += meta.bareSoil;
      currentBuiltUp += meta.builtUp;

      // Adjust LST delta based on green roofs policy
      let cellLst = meta.lstDelta;
      if (policyGreenRoofs && (cell.type === "residential" || cell.type === "industrial")) {
        cellLst -= 1.2;
      }
      baseLst += cellLst;

      if (cell.type === "dense-forest" || cell.type === "sparse-forest") {
        forestCount += 1;
      }

      if (cell.type === "residential") residentialCount += 1;
      if (cell.type === "industrial") industrialCount += 1;
      if (cell.type === "green-highway") roadCount += 1;
    }

    const canopyPct = currentCanopy / GRID_SIZE ** 2;
    const bareSoilPct = currentBareSoil / GRID_SIZE ** 2;
    const builtUpPct = currentBuiltUp / GRID_SIZE ** 2;
    
    // LST is normalized relative delta
    const lstDelta = baseLst / GRID_SIZE ** 2;

    const canopyLoss = initialStats.canopy > 0
      ? Math.max(0, (initialStats.canopy - canopyPct) / initialStats.canopy) * 100
      : 0;

    // Forest fragmentation check using Flood Fill connected components
    // A cell is index-mapped. We do BFS/DFS to count forest patches
    const visited = new Set<number>();
    let forestPatches = 0;

    for (let r = 0; r < GRID_SIZE; r += 1) {
      for (let c = 0; c < GRID_SIZE; c += 1) {
        const idx = r * GRID_SIZE + c;
        const cell = grid[idx];
        const isForest = cell.type === "dense-forest" || cell.type === "sparse-forest";
        
        if (isForest && !visited.has(idx)) {
          forestPatches += 1;
          // Traverse whole cluster
          const queue = [idx];
          visited.add(idx);
          while (queue.length > 0) {
            const curr = queue.shift()!;
            const cr = Math.floor(curr / GRID_SIZE);
            const cc = curr % GRID_SIZE;
            
            // Look up, down, left, right
            const neighbors = [
              { r: cr - 1, c: cc },
              { r: cr + 1, c: cc },
              { r: cr, c: cc - 1 },
              { r: cr, c: cc + 1 }
            ];

            for (const n of neighbors) {
              if (n.r >= 0 && n.r < GRID_SIZE && n.c >= 0 && n.c < GRID_SIZE) {
                const nIdx = n.r * GRID_SIZE + n.c;
                const nCell = grid[nIdx];
                const nForest = nCell.type === "dense-forest" || nCell.type === "sparse-forest";
                if (nForest && !visited.has(nIdx)) {
                  visited.add(nIdx);
                  queue.push(nIdx);
                }
              }
            }
          }
        }
      }
    }

    // Fragmentation index logic:
    // 0 patches = 100% fragmentation
    // 1 patch = base fragmentation (e.g. 10% or 0%)
    // Multi patches = fragmented. e.g. 10% + 25% * (patches - 1)
    let fragmentationIndex = 0;
    if (forestCount === 0) {
      fragmentationIndex = 100;
    } else if (forestPatches > 1) {
      fragmentationIndex = Math.min(100, 10 + (forestPatches - 1) * 20);
    } else {
      fragmentationIndex = 5; // stable single block
    }

    // Adjust fragmentation score if Wildlife Corridors policy is active
    if (policyWildlife && fragmentationIndex > 5) {
      fragmentationIndex = Math.max(5, fragmentationIndex - 35);
    }

    // Bare soil erosion risk index: BSI percentage
    let soilRiskScore = bareSoilPct * 1.5;
    if (policyDrainage) {
      soilRiskScore = Math.max(0, soilRiskScore - 12);
    }
    soilRiskScore = Math.min(100, Math.max(0, soilRiskScore));

    // Calculate Overall Ecological Health Score
    // Starts at 100, drops on deforestation, fragmentation, heat delta, erosion
    const deforestationPenalty = canopyLoss * 0.9;
    const fragmentationPenalty = Math.max(0, fragmentationIndex - 5) * 0.45;
    const heatPenalty = Math.max(0, lstDelta + 0.8) * 8.5; // offset normal baseline
    const soilPenalty = soilRiskScore * 0.35;

    const rawScore = 100 - (deforestationPenalty + fragmentationPenalty + heatPenalty + soilPenalty);
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    let grade = "F";
    let gradeColor = "risk";
    let gradeText = "Ecological Collapse";
    
    if (score >= 85) {
      grade = "A";
      gradeColor = "good";
      gradeText = "Regenerative Urban Design";
    } else if (score >= 70) {
      grade = "B";
      gradeColor = "good-subtle";
      gradeText = "Sustainable Siting";
    } else if (score >= 55) {
      grade = "C";
      gradeColor = "watch";
      gradeText = "Ecological Modification";
    } else if (score >= 40) {
      grade = "D";
      gradeColor = "watch-severe";
      gradeText = "High Disruption Risk";
    }

    return {
      canopyPct,
      bareSoilPct,
      builtUpPct,
      lstDelta,
      canopyLoss,
      fragmentationIndex,
      soilRiskScore,
      score,
      grade,
      gradeColor,
      gradeText,
      residentialCount,
      industrialCount,
      roadCount,
      forestCount,
      forestPatches
    };
  }, [grid, policyGreenRoofs, policyWildlife, policyDrainage, initialStats]);

  // Edit cell handlers
  function paintCell(id: number) {
    setGrid((prev) =>
      prev.map((cell) => {
        if (cell.id !== id) return cell;
        
        let newType = cell.type;
        if (selectedTool === "clear") {
          newType = cell.initialType;
        } else {
          newType = selectedTool;
        }

        return { ...cell, type: newType };
      })
    );
  }

  function handleCellMouseDown(id: number) {
    setIsMouseDown(true);
    paintCell(id);
  }

  function handleCellMouseEnter(id: number) {
    if (isMouseDown) {
      paintCell(id);
    }
  }

  function handleMouseUp() {
    setIsMouseDown(false);
  }

  // Preset Loaders
  function loadScenario(scenarioName: string) {
    setGrid((prev) => {
      const initialGrid = createNaturalGrid();
      
      if (scenarioName === "wilderness") {
        // All natural state
        setPolicyWildlife(false);
        setPolicyGreenRoofs(false);
        setPolicyDrainage(false);
        return initialGrid;
      }

      if (scenarioName === "sprawl") {
        // Industrial and residential slicing right through the center core
        setPolicyWildlife(false);
        setPolicyGreenRoofs(false);
        setPolicyDrainage(false);
        
        return initialGrid.map((cell) => {
          // Central row slice for infrastructure/roads (row 4)
          if (cell.row === 4) {
            return { ...cell, type: "green-highway" };
          }
          // Center mining pit and industrial zone
          if (cell.row >= 3 && cell.row <= 5 && cell.col >= 3 && cell.col <= 6) {
            return { ...cell, type: "industrial" };
          }
          // Urban residential blocks scattered in surrounding forest
          if ((cell.row === 2 || cell.row === 6) && cell.col >= 2 && cell.col <= 7) {
            return { ...cell, type: "residential" };
          }
          return cell;
        });
      }

      if (scenarioName === "sustainable") {
        // Development restricted to southern border edge, keeping central core intact
        setPolicyWildlife(true);
        setPolicyGreenRoofs(true);
        setPolicyDrainage(true);

        return initialGrid.map((cell) => {
          // Highway runs along bottom edge (row 9)
          if (cell.row === 9 && cell.col !== 0 && cell.col !== 9) {
            return { ...cell, type: "green-highway" };
          }
          // Residential blocks nested near the road at the bottom
          if (cell.row === 8 && cell.col >= 2 && cell.col <= 7) {
            return { ...cell, type: "residential" };
          }
          // Small industrial block restricted to southern periphery
          if (cell.row === 8 && cell.col === 1) {
            return { ...cell, type: "industrial" };
          }
          return cell;
        });
      }

      if (scenarioName === "ecovillage") {
        // Micro-settlements in the corner grasslands, leaving the forest completely isolated
        setPolicyWildlife(true);
        setPolicyGreenRoofs(false);
        setPolicyDrainage(true);

        return initialGrid.map((cell) => {
          // Place homes only in grassland regions (row 0-1, col 0-2) and (row 8-9, col 7-8)
          const isCornerGrass1 = cell.row <= 1 && cell.col <= 2 && cell.type === "grassland";
          const isCornerGrass2 = cell.row >= 8 && cell.col >= 7 && cell.col <= 9 && cell.type === "grassland";
          
          if (isCornerGrass1 || isCornerGrass2) {
            return { ...cell, type: "residential" };
          }
          return cell;
        });
      }

      return prev;
    });
  }

  function resetAll() {
    setGrid(createNaturalGrid());
    setPolicyWildlife(false);
    setPolicyGreenRoofs(false);
    setPolicyDrainage(false);
  }

  return (
    <main className="page sandbox-page" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <section className="sandbox-hero">
        <div>
          <span className="badge">Zoning Sandbox</span>
          <h1>Simulate Eco-Planning & Urban Siting footprints.</h1>
          <p>
            Paint development blocks on the satellite grid. Our real-time simulator computes canopy loss,
            forest fragmentation (connected corridors), heat island LST delta, and runoff risk to grade your plan.
          </p>
        </div>
        <div className="sandbox-scenario-presets surface">
          <span>Simulation Presets</span>
          <div className="scenario-buttons">
            <button type="button" onClick={() => loadScenario("wilderness")} className="preset-btn">
              <Trees size={14} /> Natural State
            </button>
            <button type="button" onClick={() => loadScenario("sprawl")} className="preset-btn warning-btn">
              <Flame size={14} /> Unplanned Sprawl
            </button>
            <button type="button" onClick={() => loadScenario("sustainable")} className="preset-btn success-btn">
              <Sparkles size={14} /> Smart Growth
            </button>
            <button type="button" onClick={() => loadScenario("ecovillage")} className="preset-btn info-btn">
              <Leaf size={14} /> Eco-Village
            </button>
          </div>
        </div>
      </section>

      {/* Main Sandbox Grid */}
      <div className="sandbox-grid-layout">
        {/* Left Hand Map Editor */}
        <section className="surface sandbox-map-panel">
          <div className="surface-head">
            <div>
              <h2>Interactive Siting Canvas</h2>
              <p className="muted">Click and drag to paint zones. Clear to restore natural landscape.</p>
            </div>
            <button type="button" className="btn btn-reset" onClick={resetAll} aria-label="Reset canvas">
              <RefreshCcw size={14} /> Reset
            </button>
          </div>

          {/* Floating Paint Palette */}
          <div className="paint-palette">
            {Object.values(CELL_META).map((meta) => {
              const active = selectedTool === meta.type;
              return (
                <button
                  type="button"
                  key={meta.type}
                  className={`palette-item ${active ? "active" : ""}`}
                  onClick={() => setSelectedTool(meta.type)}
                  style={{ "--border-color": meta.color } as React.CSSProperties}
                  title={meta.description}
                >
                  <span className="palette-color" style={{ backgroundColor: meta.color }} />
                  <span className="palette-label">{meta.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={`palette-item erase-tool ${selectedTool === "clear" ? "active" : ""}`}
              onClick={() => setSelectedTool("clear")}
              title="Revert cells back to their initial natural vegetation state."
            >
              <Trash2 size={14} />
              <span className="palette-label">Erase / Clear</span>
            </button>
          </div>

          {/* SVG Map Grid */}
          <div className="map-grid-container">
            <div className="grid-labels-row">
              {Array.from({ length: GRID_SIZE }).map((_, idx) => (
                <span key={idx} className="grid-label">{String.fromCharCode(65 + idx)}</span>
              ))}
            </div>
            <div className="grid-main-row">
              <div className="grid-labels-col">
                {Array.from({ length: GRID_SIZE }).map((_, idx) => (
                  <span key={idx} className="grid-label">{idx + 1}</span>
                ))}
              </div>
              <div className="grid-svg-wrapper">
                <svg
                  viewBox="0 0 400 400"
                  width="100%"
                  height="100%"
                  role="grid"
                  aria-label="Planning Sandbox Grid"
                >
                  {grid.map((cell) => {
                    const meta = CELL_META[cell.type];
                    const x = cell.col * 40;
                    const y = cell.row * 40;
                    
                    // Render inner markers to give premium visual cues
                    let cellSymbol = null;
                    if (cell.type === "dense-forest") {
                      cellSymbol = (
                        <circle cx={x + 20} cy={y + 20} r="3" fill="rgba(255,255,255,0.25)" />
                      );
                    } else if (cell.type === "water") {
                      cellSymbol = (
                        <line x1={x + 10} y1={y + 20} x2={x + 30} y2={y + 20} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
                      );
                    } else if (cell.type === "residential") {
                      cellSymbol = (
                        <path d={`M ${x+15} ${y+25} L ${x+20} ${y+16} L ${x+25} ${y+25} Z`} fill="rgba(255,255,255,0.5)" />
                      );
                    } else if (cell.type === "industrial") {
                      cellSymbol = (
                        <rect x={x+15} y={y+16} width="10" height="10" fill="rgba(255,255,255,0.4)" />
                      );
                    } else if (cell.type === "green-highway") {
                      cellSymbol = (
                        <line x1={x+5} y1={y+20} x2={x+35} y2={y+20} stroke="#ffffff" strokeWidth="2.5" strokeDasharray="3 3" />
                      );
                    }

                    return (
                      <g key={cell.id}>
                        <rect
                          x={x}
                          y={y}
                          width="38.5"
                          height="38.5"
                          rx="4"
                          fill={meta.color}
                          className={`sandbox-grid-rect ${meta.bgClass}`}
                          onMouseDown={() => handleCellMouseDown(cell.id)}
                          onMouseEnter={() => handleCellMouseEnter(cell.id)}
                        />
                        {cellSymbol}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          <div className="grid-legend">
            <span><i className="legend-wilderness" /> Forest Core</span>
            <span><i className="legend-water" /> Waterway</span>
            <span><i className="legend-developed" /> Developed (Urban/Industrial)</span>
            <span><i className="legend-corridor" /> Green Infrastructure</span>
          </div>
        </section>

        {/* Right Hand Sidebar - Scores & Metrics */}
        <aside className="sandbox-sidebar flex-column">
          {/* Eco score panel */}
          <section className="surface eco-scorecard flex-column align-center text-center">
            <span className="eyebrow">Eco-Planning Health</span>
            <div className={`score-badge-ring ${simulation.gradeColor}`}>
              <div className="score-ring-inner">
                <strong>{simulation.score}</strong>
                <span>Grade {simulation.grade}</span>
              </div>
            </div>
            <h3 className="score-grade-text">{simulation.gradeText}</h3>
            <p className="muted text-small">
              Derived from forest loss, habitat fragmentation, heat index, and soil protection rules.
            </p>
          </section>

          {/* Mitigation Policies Panel */}
          <section className="surface policy-toggles">
            <div className="surface-head">
              <div>
                <h2>Mitigation Policies</h2>
                <p className="muted">Enact regulations to buffer development impacts.</p>
              </div>
              <SlidersHorizontal size={16} className="text-muted" />
            </div>

            <div className="toggle-list">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={policyWildlife}
                  onChange={(e) => setPolicyWildlife(e.target.checked)}
                />
                <div className="toggle-copy">
                  <strong>Wildlife Corridors / Underpasses</strong>
                  <span>Mitigates fragmentation score by adding habitat passes.</span>
                </div>
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={policyGreenRoofs}
                  onChange={(e) => setPolicyGreenRoofs(e.target.checked)}
                />
                <div className="toggle-copy">
                  <strong>Urban Canopy / Green Roof Mandate</strong>
                  <span>Cools residential and industrial thermal LST delta.</span>
                </div>
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={policyDrainage}
                  onChange={(e) => setPolicyDrainage(e.target.checked)}
                />
                <div className="toggle-copy">
                  <strong>Eco-Drainage & Bioswales</strong>
                  <span>Lowers erosion risks associated with soil disturbance.</span>
                </div>
              </label>
            </div>
          </section>

          {/* Dynamic Indicators */}
          <section className="surface indicators-list flex-column gap-12">
            <h2>Simulation Indicators</h2>

            {/* Canopy Loss */}
            <article className="indicator-strip">
              <div className="indicator-summary">
                <div className="indicator-label-row">
                  <Trees size={16} />
                  <span>Deforestation (Canopy Loss)</span>
                </div>
                <strong className={simulation.canopyLoss > 20 ? "text-danger" : simulation.canopyLoss > 5 ? "text-warning" : "text-success"}>
                  {simulation.canopyLoss.toFixed(1)}%
                </strong>
              </div>
              <div className="progress-bar">
                <i className={`bar-fill ${simulation.canopyLoss > 20 ? "fill-danger" : simulation.canopyLoss > 5 ? "fill-warning" : "fill-success"}`} style={{ width: `${simulation.canopyLoss}%` }} />
              </div>
              <p className="indicator-detail">
                Natural canopy dropped from {initialStats.canopy.toFixed(0)}% to {simulation.canopyPct.toFixed(0)}% total coverage.
              </p>
            </article>

            {/* Fragmentation */}
            <article className="indicator-strip">
              <div className="indicator-summary">
                <div className="indicator-label-row">
                  <Compass size={16} />
                  <span>Forest Fragmentation</span>
                </div>
                <strong className={simulation.fragmentationIndex > 45 ? "text-danger" : simulation.fragmentationIndex > 15 ? "text-warning" : "text-success"}>
                  {simulation.fragmentationIndex}%
                </strong>
              </div>
              <div className="progress-bar">
                <i className={`bar-fill ${simulation.fragmentationIndex > 45 ? "fill-danger" : simulation.fragmentationIndex > 15 ? "fill-warning" : "fill-success"}`} style={{ width: `${simulation.fragmentationIndex}%` }} />
              </div>
              <p className="indicator-detail">
                Forest is split into <strong>{simulation.forestPatches} separate clusters</strong>. Corridors are {simulation.forestPatches > 1 ? "severed" : "connected"}.
              </p>
            </article>

            {/* LST Delta */}
            <article className="indicator-strip">
              <div className="indicator-summary">
                <div className="indicator-label-row">
                  <Thermometer size={16} />
                  <span>Heat Island (LST Delta)</span>
                </div>
                <strong className={simulation.lstDelta > 1.2 ? "text-danger" : simulation.lstDelta > 0.1 ? "text-warning" : "text-success"}>
                  {simulation.lstDelta >= 0 ? "+" : ""}{simulation.lstDelta.toFixed(2)}°C
                </strong>
              </div>
              <div className="progress-bar">
                <i
                  className={`bar-fill ${simulation.lstDelta > 1.2 ? "fill-danger" : simulation.lstDelta > 0.1 ? "fill-warning" : "fill-success"}`}
                  style={{ width: `${Math.max(0, Math.min(100, (simulation.lstDelta + 2) * 20))}%` }}
                />
              </div>
              <p className="indicator-detail">
                Average thermal delta relative to baseline natural landscape temperature.
              </p>
            </article>

            {/* Soil Exposure / Erosion */}
            <article className="indicator-strip">
              <div className="indicator-summary">
                <div className="indicator-label-row">
                  <Waves size={16} />
                  <span>Erosion Risk (Exposed Soil)</span>
                </div>
                <strong className={simulation.soilRiskScore > 40 ? "text-danger" : simulation.soilRiskScore > 15 ? "text-warning" : "text-success"}>
                  {simulation.soilRiskScore.toFixed(0)}/100
                </strong>
              </div>
              <div className="progress-bar">
                <i className={`bar-fill ${simulation.soilRiskScore > 40 ? "fill-danger" : simulation.soilRiskScore > 15 ? "fill-warning" : "fill-success"}`} style={{ width: `${simulation.soilRiskScore}%` }} />
              </div>
              <p className="indicator-detail">
                Calculated runoff danger from bare ground ratio ({simulation.bareSoilPct.toFixed(0)}% exposed soil).
              </p>
            </article>
          </section>

          {/* Footprint inventory */}
          <section className="surface footprint-inventory">
            <h2>Placement Inventory</h2>
            <div className="inventory-grid">
              <div>
                <span>Homes</span>
                <strong>{simulation.residentialCount} blocks</strong>
              </div>
              <div>
                <span>Industry/Mining</span>
                <strong>{simulation.industrialCount} blocks</strong>
              </div>
              <div>
                <span>Infrastructure</span>
                <strong>{simulation.roadCount} blocks</strong>
              </div>
              <div>
                <span>Forest Sectors</span>
                <strong>{simulation.forestCount} blocks</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Siting Guidelines & Cautions */}
      <section className="surface sandbox-guidelines">
        <div className="surface-head">
          <div>
            <h2>Sustainable Siting Guidelines</h2>
            <p className="muted">Use remote sensing insights to build high-scoring eco-plans.</p>
          </div>
          <Info size={20} className="text-muted" />
        </div>
        <div className="guidelines-grid">
          <article>
            <CheckCircle2 className="text-success" size={18} />
            <strong>A-Grade Siting Policy</strong>
            <p>
              Restrict built-up spaces to the outer edges. Slicing through the central woodland with highways
              increases forest fragmentation scores and drops the final health score.
            </p>
          </article>
          <article>
            <AlertTriangle className="text-warning" size={18} />
            <strong>Thermal Heat Abatement</strong>
            <p>
              Residential and industrial spaces increase local temperature up to +4.5°C. Enact the Green Roof Mandate
              and cluster residential zones near forest borders to cool the heat footprint.
            </p>
          </article>
          <article>
            <ShieldAlert className="text-danger" size={18} />
            <strong>Soil Preservation</strong>
            <p>
              Excess industrial excavation exposes bare soil. Enable bioswales and restrict mining footprints to avoid
              high erosion and heavy sediment runoff penalties.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
