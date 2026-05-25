import { ArrowDownRight, Flame, Layers3, MapPinned, Trees } from "lucide-react";

const evidence = [
  {
    icon: MapPinned,
    title: "Study area",
    body: "Hasdeo Arand and nearby control regions are selected as the primary monitoring area for deforestation and mining impact analysis."
  },
  {
    icon: Layers3,
    title: "Observation stack",
    body: "The project combines RGB inspection imagery, multispectral Sentinel bands, monthly feature tables, and QGIS-labeled training areas."
  },
  {
    icon: ArrowDownRight,
    title: "Expected signal",
    body: "Vegetation indices should decline during clearance windows, while bare-soil and built-up indicators should rise."
  },
  {
    icon: Flame,
    title: "Event focus",
    body: "The March-April 2022 event window is treated as a key disturbance period for the Hasdeo comparison workflow."
  }
];

export default function HypothesisPage() {
  return (
    <main className="page hypothesis">
      <section className="hypothesis-hero">
        <span className="badge">Part 1 hypothesis</span>
        <h1>Forest degradation can be detected through synchronized drops in vegetation indices and rises in exposed-land signals.</h1>
      </section>

      <section className="hypothesis-grid">
        <article className="surface">
          <div className="surface-head">
            <div>
              <h2>Research framing</h2>
              <p className="muted">The web layer turns the original project hypothesis into an inspectable evidence trail.</p>
            </div>
            <Trees size={24} aria-hidden />
          </div>
          <p>
            The working hypothesis is that major land-cover disruption in Hasdeo will appear as a measurable shift
            across satellite-derived features. Healthy canopy should retain higher NDVI, EVI, SAVI, LAI, and GCI values.
            Disturbed, mined, or cleared areas should show stronger BSI, NDBI, and heat-related signatures.
          </p>
          <p>
            The timeline dashboard is designed to test that hypothesis interactively: a user selects a region, chooses
            a before/after window, switches feature indicators, and compares the nearest curated images against the
            numeric feature timeline.
          </p>
        </article>

        <aside className="surface">
          <h2>Decision rule</h2>
          <p className="muted">
            A degradation window is considered stronger when vegetation features fall while bare-soil, built-up, or
            thermal features increase in the same period.
          </p>
          <ul className="evidence-list">
            <li>
              <strong>Vegetation loss:</strong> NDVI, EVI, SAVI, LAI, or GCI decreases.
            </li>
            <li>
              <strong>Surface exposure:</strong> BSI or NDBI increases.
            </li>
            <li>
              <strong>Context check:</strong> curated imagery visually supports the feature movement.
            </li>
          </ul>
        </aside>
      </section>

      <section className="surface">
        <div className="surface-head">
          <div>
            <h2>Evidence components</h2>
            <p className="muted">These are the pieces the application exposes to make the hypothesis auditable.</p>
          </div>
        </div>
        <ul className="evidence-list">
          {evidence.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <div className="status-line">
                  <Icon size={17} aria-hidden />
                  <strong>{item.title}</strong>
                </div>
                <p className="muted">{item.body}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
