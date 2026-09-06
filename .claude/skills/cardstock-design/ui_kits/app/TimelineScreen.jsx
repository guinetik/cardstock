const { Sq, Stat, Icon, EpicLabel } = window.CardstockDesignSystem_acd70a;

/**
 * Timeline: what has been raised, what is dated, and what has been forgotten.
 * Work begins at its raised date; the watchlist calls out anything still
 * unplanned after the project window.
 */
function TimelineScreen({ data, onView, view }) {
  const [windowDays, setWindowDays] = React.useState(14);
  const rows = data.cards.filter((c) => c.signal === "forgotten");
  const laneName = (key) => data.lanes.find((l) => l.key === key)?.name ?? key;
  const built = data.cards.filter((c) => c.status === "built");
  const shipped = data.cards.filter((c) => c.status === "shipped");
  return (
    <main style={{ margin: "0 auto", width: "100%", maxWidth: "64rem", padding: "28px 24px 48px" }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onView("board"); }}>← {data.board.name}</a>
      </p>
      <h1>Timeline</h1>
      <p style={{ marginTop: 10, fontSize: 13.5, color: "var(--color-ink2)" }}>
        Work begins at its raised date. The watchlist calls out anything still unplanned after {windowDays} days.
      </p>
      <ViewLinks view={view} onView={onView} items={[["board", "Board"], ["cockpit", "Epic Cockpit"], ["calendar", "Calendar"], ["project", "Project"]]} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "baseline", margin: "22px 0 18px", padding: "14px 0", borderTop: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)", fontSize: 12.5, color: "var(--color-grey)" }}>
        <span><b style={{ color: "var(--color-ink)", fontSize: 14 }}>{data.cards.length}</b> raised</span>
        <span><b style={{ color: "var(--pen-blue)", fontSize: 14 }}>2</b> dated</span>
        <span><b style={{ color: "var(--pen-red)", fontSize: 14 }}>{rows.length}</b> forgotten</span>
        <span><b style={{ color: "var(--color-ink)", fontSize: 14 }}>0</b> missing a raised date</span>
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="field-label">Window</span>
          <select className="paper-field" style={{ fontSize: 12.5 }} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
          </select>
        </label>
      </div>

      <section className="paper-card paper-card--static" style={{ boxShadow: "inset 3px 0 0 var(--pen-red), var(--shadow-card)", padding: "18px 22px" }}>
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22 }}>Needs attention</h2>
            <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--color-grey)" }}>Unplanned past the project window, or still open after its target.</p>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pen-red)" }}>{rows.length} cards</span>
        </header>
        <div style={{ marginTop: 14 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "108px minmax(0,1fr) auto auto 108px", alignItems: "center", gap: 14, padding: "10px 0", borderTop: "1px solid var(--border-hairline)" }}>
              <span style={{ display: "flex", gap: 6 }}>
                <Stat tone="muted" flat>assess</Stat>
                <Stat tone="blocked" flat>forgotten</Stat>
              </span>
              <span style={{ display: "flex", minWidth: 0, alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-grey-faint)" }}>#{c.id}</span>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</a>
              </span>
              <span style={{ fontSize: 11.5, color: "var(--color-grey)", whiteSpace: "nowrap" }}>{c.raised} · no target</span>
              <span style={{ display: "flex", gap: 4 }}>
                {c.priority && <Sq on pen={PRIORITY_PEN[c.priority]}>P{c.priority}</Sq>}
                {c.effort && <Sq on pen={EFFORT_PEN[c.effort]}>{c.effort}</Sq>}
              </span>
              <span className="stat stat--faint" style={{ justifyContent: "flex-end" }}>{laneName(c.lane)}</span>
            </div>
          ))}
        </div>
      </section>

      <h2 style={{ fontSize: 22, marginTop: 32 }}>Relative to today</h2>
      <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--color-grey)" }}>What crossed Built and Shipped during the last {windowDays} days.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginTop: 14 }}>
        {[["Built", built, "var(--pen-blue)"], ["Shipped", shipped, "var(--pen-green)"]].map(([label, list, pen]) => (
          <section key={label} className="paper-card paper-card--static" style={{ borderTop: `2px solid ${pen}`, padding: "14px 16px" }}>
            <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 18 }}>{label}</h3>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-grey)" }}>{list.length}</span>
            </header>
            {list.length ? list.map((c) => (
              <p key={c.id} style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-grey-faint)" }}>#{c.id}</span>
                <span style={{ flex: 1 }}>{c.title}</span>
                <span className="stat stat--faint">today</span>
              </p>
            )) : <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--color-grey-faint)" }}>Nothing crossed in this window.</p>}
          </section>
        ))}
      </div>
    </main>
  );
}

Object.assign(window, { TimelineScreen });
