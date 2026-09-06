const { Stat, Eyebrow, Icon } = window.CardstockDesignSystem_acd70a;

const OUTLOOK_LABEL = { "at-risk": "At risk", attention: "Attention", planning: "Planning", "on-track": "On track" };
const OUTLOOK_TONE = { "at-risk": "danger", attention: "attention", planning: "muted", "on-track": "success" };
const MARK = { delivered: "✓", blocked: "!", late: "◷", moving: "→", queued: "" };

/** The task-light map: one square per task, coloured by the cockpit pens. */
function TaskMap({ epic }) {
  const cells = [];
  for (let i = 0; i < epic.delivered; i++) cells.push("delivered");
  for (let i = 0; i < epic.blocked; i++) cells.push("blocked");
  for (let i = 0; i < epic.late; i++) cells.push("late");
  while (cells.length < epic.total) cells.push("queued");
  return (
    <div className="cockpit-map" style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {cells.map((signal, i) => (
        <span key={i} title={signal}
          style={{ display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: "var(--radius-card)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--pen-ink)", background: `var(--signal-${signal})` }}>
          {MARK[signal]}
        </span>
      ))}
    </div>
  );
}

/**
 * Epic Cockpit: the shelved tomes, their task-light maps and their
 * commitments. Where you take stock of a board rather than work it.
 */
function CockpitScreen({ data, onView, view }) {
  const [query, setQuery] = React.useState("");
  const [outlook, setOutlook] = React.useState("all");
  const epics = data.epics.filter((e) =>
    (outlook === "all" || e.outlook === outlook) &&
    (!query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase())));
  const totals = data.epics.reduce((a, e) => ({
    tasks: a.tasks + e.total, delivered: a.delivered + e.delivered,
    blocked: a.blocked + e.blocked, late: a.late + e.late,
  }), { tasks: 0, delivered: 0, blocked: 0, late: 0 });
  const metrics = [
    ["Tasks in flight", String(totals.tasks - totals.delivered), "Clipped into an epic and not yet delivered.", "info"],
    ["Delivered", String(totals.delivered), "Crossed a done lane, all epics.", "success"],
    ["Late", String(totals.late), "Past its target and still open.", "attention"],
    ["Blocked", String(totals.blocked), "Waiting on a person or a decision.", "danger"],
  ];
  return (
    <main style={{ margin: "0 auto", width: "100%", maxWidth: "72rem", padding: "28px 24px 48px" }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onView("board"); }}>← {data.board.name}</a>
      </p>
      <h1>Epic Cockpit</h1>
      <p style={{ marginTop: 10, fontSize: 13.5, color: "var(--color-ink2)", maxWidth: "44rem" }}>
        Every epic on this board as a tome on the desk: its outcome, its task lights, and the day it is committed to.
      </p>
      <ViewLinks view={view} onView={onView} items={[["board", "Board"], ["timeline", "Timeline"], ["calendar", "Calendar"], ["project", "Project"]]} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, margin: "22px 0" }}>
        {metrics.map(([label, value, note, tone]) => (
          <div key={label} className="paper-card paper-card--static" style={{ padding: 16 }}>
            <p><Stat tone={tone}>{label}</Stat></p>
            <p style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 26, lineHeight: 1, color: "var(--color-ink)" }}>{value}</p>
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-grey)" }}>{note}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <input className="paper-field" style={{ width: 240, fontSize: 13 }} placeholder="Search epics and tasks"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search epics" />
        <fieldset className="fieldset">
          <legend>Outlook</legend>
          {["all", "on-track", "attention", "at-risk", "planning"].map((o) => (
            <button key={o} type="button" aria-pressed={outlook === o} onClick={() => setOutlook(o)}
              className={`stat stat--${o === "all" ? "muted" : OUTLOOK_TONE[o]}`}
              style={outlook === o ? { color: "var(--color-ink)", textDecoration: "underline", textUnderlineOffset: 3 } : undefined}>
              {o === "all" ? "any" : OUTLOOK_LABEL[o]}
            </button>
          ))}
        </fieldset>
        <button type="button" className="paper-btn paper-btn--sm" style={{ marginLeft: "auto" }}>New epic</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        {epics.map((e) => (
          <article key={e.name} className={`cockpit-epic cockpit-epic--${e.outlook}`} data-outlook={e.outlook}>
            <header style={{ display: "flex", alignItems: "flex-start", gap: 12, borderBottom: "1px solid var(--border-hairline)", paddingBottom: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Eyebrow>Epic · {e.owner}</Eyebrow>
                <h2 style={{ fontSize: 18, marginTop: 2 }}>
                  <a href="#" onClick={(ev) => ev.preventDefault()} style={{ color: "var(--color-ink-strong)" }}>{e.name}</a>
                </h2>
                <p style={{ marginTop: 4, fontSize: 12, color: "var(--color-grey)" }}>{e.outcome}</p>
              </div>
              <Stat tone={OUTLOOK_TONE[e.outlook]}>{OUTLOOK_LABEL[e.outlook]}</Stat>
            </header>
            <div style={{ marginTop: 12 }}><TaskMap epic={e} /></div>
            <footer style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 8, borderTop: "1px solid var(--border-hairline)", paddingTop: 12, fontSize: 12 }}>
              <span>
                <b>{e.delivered} of {e.total}</b> delivered
                {e.blocked ? ` · ${e.blocked} blocked` : ""}{e.late ? ` · ${e.late} late` : ""}
              </span>
              <span style={{ textAlign: "right", color: "var(--color-grey)" }}>
                <small style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9 }}>Commitment</small>
                <b style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink)" }}>{e.commitment}</b>
              </span>
            </footer>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 18, display: "flex", gap: 18, fontSize: 11, color: "var(--color-grey)" }}>
        {["delivered", "moving", "late", "blocked", "queued"].map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: `var(--signal-${s})` }} />{s}
          </span>
        ))}
      </p>
    </main>
  );
}

Object.assign(window, { CockpitScreen, TaskMap });
