"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Compass, MapPinned, ShieldAlert, Trees } from "lucide-react";
import type { RecommendationData, RecommendationZone } from "@/lib/recommendation";

function zoneFill(category: RecommendationZone["category"]) {
  if (category === "Preferred zone") return "rgba(31, 122, 76, 0.78)";
  if (category === "Conditional") return "rgba(211, 145, 50, 0.78)";
  return "rgba(165, 62, 50, 0.82)";
}

function zoneStroke(category: RecommendationZone["category"]) {
  if (category === "Preferred zone") return "#1f7a4c";
  if (category === "Conditional") return "#b77722";
  return "#a53e32";
}

function iconFor(category: RecommendationZone["category"]) {
  if (category === "Preferred zone") return CheckCircle2;
  if (category === "Conditional") return AlertTriangle;
  return ShieldAlert;
}

function project(bounds: [number, number, number, number], full: [number, number, number, number]) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const [fullMinLon, fullMinLat, fullMaxLon, fullMaxLat] = full;
  const width = fullMaxLon - fullMinLon;
  const height = fullMaxLat - fullMinLat;
  return {
    x: ((minLon - fullMinLon) / width) * 100,
    y: ((fullMaxLat - maxLat) / height) * 100,
    width: ((maxLon - minLon) / width) * 100,
    height: ((maxLat - minLat) / height) * 100
  };
}

export default function RecommendationDashboard({ data }: { data: RecommendationData }) {
  const [selectedId, setSelectedId] = useState(data.recommendation.primaryZoneId);
  const selected = data.zones.find((zone) => zone.id === selectedId) ?? data.zones[0];
  const fullBounds = data.studyArea.bounds;
  const plottedZones = useMemo(
    () => data.zones.map((zone) => ({ zone, rect: project(zone.bounds, fullBounds) })),
    [data.zones, fullBounds]
  );

  return (
    <main className="page recommendation-page">
      <section className="recommendation-hero">
        <div>
          <span className="badge">Decision support</span>
          <h1>Lower-impact development guidance for the Hasdeo forest boundary.</h1>
          <p>
            This planning layer ranks Hasdeo zones by ecological sensitivity, periphery advantage, and evidence confidence
            so the project can answer where development pressure should be kept lowest.
          </p>
        </div>
        <div className="recommendation-headline surface">
          <span>Primary recommendation</span>
          <strong>{data.recommendation.headline}</strong>
          <p>{data.recommendation.summary}</p>
        </div>
      </section>

      <section className="recommendation-kpis">
        <article className="stat accent-down">
          <span><Trees size={15} aria-hidden /> Disturbance signal</span>
          <strong>{Math.abs(data.context.ndviDropPct).toFixed(1)}%</strong>
          <small>NDVI drop in the March-April 2022 disturbance window.</small>
        </article>
        <article className="stat accent-amber">
          <span><ShieldAlert size={15} aria-hidden /> Surface exposure</span>
          <strong>+{data.context.bsiRisePct.toFixed(1)}%</strong>
          <small>BSI rise against the pre-event baseline.</small>
        </article>
        <article className="stat accent-blue">
          <span><Compass size={15} aria-hidden /> Thermal pressure</span>
          <strong>+{data.context.heatRisePct.toFixed(1)}%</strong>
          <small>Heat rise in the same disturbance window.</small>
        </article>
      </section>

      <div className="recommendation-grid">
        <section className="surface recommendation-map-surface">
          <div className="surface-head">
            <div>
              <h2>Hasdeo zone map</h2>
              <p className="muted">Click a zone to inspect its score and decision logic.</p>
            </div>
            <span className="badge">{selected.label}</span>
          </div>

          <div className="zone-map">
            <svg viewBox="0 0 100 100" role="img" aria-label="Hasdeo recommendation map">
              <rect x="0" y="0" width="100" height="100" rx="5" fill="#eef4ee" stroke="#cdd8cf" />
              {plottedZones.map(({ zone, rect }) => (
                <g key={zone.id} onClick={() => setSelectedId(zone.id)} style={{ cursor: "pointer" }}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    rx="2"
                    fill={zoneFill(zone.category)}
                    stroke={selected.id === zone.id ? "#07130f" : zoneStroke(zone.category)}
                    strokeWidth={selected.id === zone.id ? 1.5 : 0.7}
                  />
                  <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2} textAnchor="middle" dominantBaseline="middle">
                    {zone.label.replace("Hasdeo ", "")}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="zone-legend">
            <span><i className="good" /> Preferred zone</span>
            <span><i className="watch" /> Conditional</span>
            <span><i className="risk" /> Avoid</span>
          </div>
        </section>

        <aside className="surface recommendation-detail">
          <div className="surface-head">
            <div>
              <h2>{selected.label}</h2>
              <p className="muted">{selected.rationale}</p>
            </div>
          </div>

          <div className={`recommendation-badge ${selected.category === "Avoid" ? "risk" : selected.category === "Conditional" ? "watch" : "good"}`}>
            {selected.category}
          </div>

          <div className="recommendation-metric-grid">
            <div>
              <span>Suitability</span>
              <strong>{selected.suitabilityScore.toFixed(0)}</strong>
            </div>
            <div>
              <span>Risk</span>
              <strong>{selected.environmentalRisk.toFixed(0)}</strong>
            </div>
            <div>
              <span>Core overlap</span>
              <strong>{selected.coreOverlapPct.toFixed(1)}%</strong>
            </div>
            <div>
              <span>Periphery</span>
              <strong>{selected.peripheralAccessPct.toFixed(1)}%</strong>
            </div>
          </div>

          <div className="score-breakdown">
            <h3>Score breakdown</h3>
            <div className="score-row">
              <span>Core sensitivity</span>
              <div><i style={{ width: `${selected.coreOverlapPct}%` }} /></div>
            </div>
            <div className="score-row">
              <span>Centrality</span>
              <div><i style={{ width: `${selected.centralityPct}%` }} /></div>
            </div>
            <div className="score-row">
              <span>Periphery advantage</span>
              <div><i style={{ width: `${selected.peripheralAccessPct}%` }} /></div>
            </div>
            <div className="score-row">
              <span>Evidence confidence</span>
              <div><i style={{ width: `${selected.evidenceScore}%` }} /></div>
            </div>
          </div>

          <ul className="evidence-list">
            {selected.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="surface">
        <div className="surface-head">
          <div>
            <h2>Zone ranking</h2>
            <p className="muted">Higher scores indicate lower expected ecological disruption under this planning heuristic.</p>
          </div>
        </div>
        <div className="recommendation-rank-grid">
          {data.zones.map((zone, index) => {
            const Icon = iconFor(zone.category);
            return (
              <button
                type="button"
                key={zone.id}
                className={`rank-card ${selected.id === zone.id ? "active" : ""}`}
                onClick={() => setSelectedId(zone.id)}
              >
                <div>
                  <span>#{index + 1}</span>
                  <Icon size={18} aria-hidden />
                </div>
                <strong>{zone.label}</strong>
                <p>{zone.category}</p>
                <em>{zone.suitabilityScore.toFixed(0)}/100 suitability</em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface">
        <div className="surface-head">
          <div>
            <h2>Method and cautions</h2>
            <p className="muted">This layer is designed to support planning discussions, not replace formal ecological clearance work.</p>
          </div>
          <MapPinned size={20} aria-hidden />
        </div>
        <div className="recommendation-method-grid">
          {data.methodology.map((item) => (
            <article key={item.label}>
              <span>{Math.round(item.weight * 100)}%</span>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
        <div className="recommendation-note">
          <strong>Current evidence note:</strong> {data.context.disturbanceWindow} {data.context.recoverySignal}
        </div>
      </section>
    </main>
  );
}
