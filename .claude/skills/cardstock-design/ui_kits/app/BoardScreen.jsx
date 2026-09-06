const { PaperLane, LaneHead, LANE_INK, Sq, Stat, Mark, Icon, Eyebrow } = window.CardstockDesignSystem_acd70a;

function Caret() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8 9.5 4.5" /></svg>
  );
}

/**
 * The filter bar, laid out as a printed form: every cluster is a fieldset
 * with a legend, so P1-P3 and L/M/H never appear as bare abbreviations. Only
 * the search field stands alone, because a search box explains itself.
 */
function FilterBar({ f, onChange, groups, openMenu, setOpenMenu }) {
  const toggle = (set, v) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n; };
  const check = { display: "flex", cursor: "pointer", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--color-ink2)" };
  const menu = { position: "absolute", left: 0, top: "100%", zIndex: 20, marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px 8px", maxWidth: "22rem", borderRadius: "var(--radius-card)", border: "1px solid var(--border-strong)", background: "var(--surface-raised)", padding: 12, boxShadow: "var(--shadow-lift)" };
  const filtering = f.query || f.priority.size || f.effort.size || f.tags.size || f.status;
  return (
    <div className="paper-topbar" style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: "12px", borderTop: "1px solid var(--border-hairline)", padding: "12px 24px" }}>
      <input type="search" placeholder="Search #id or title" className="paper-field lane-column-width"
        style={{ height: "auto", flexShrink: 0, fontSize: 13.5 }} aria-label="Search"
        value={f.query} onChange={(e) => onChange({ ...f, query: e.target.value })} />

      <fieldset className="fieldset" style={{ position: "relative" }}>
        <legend>Tags</legend>
        {groups.map((g) => {
          const on = g.tags.filter((t) => f.tags.has(t)).length;
          const open = openMenu === g.name;
          return (
            <span key={g.name} style={{ position: "relative" }}>
              <button type="button" onClick={() => setOpenMenu(open ? null : g.name)}
                style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 2, fontSize: 13, color: on ? "var(--color-ink)" : "var(--color-ink2)", borderBottom: on ? `2px solid var(--mark-${g.hue})` : "2px solid transparent" }}>
                {g.name}{on ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{on}</span> : null}<Caret />
              </button>
              {open && (
                <div style={menu}>
                  {g.tags.map((t) => (
                    <button key={t} type="button" aria-pressed={f.tags.has(t)}
                      className={`mark mark--${g.hue} ${f.tags.has(t) ? "" : "mark--off"}`}
                      onClick={() => onChange({ ...f, tags: toggle(f.tags, t) })}>{t}</button>
                  ))}
                </div>
              )}
            </span>
          );
        })}
      </fieldset>

      <fieldset className="fieldset">
        <legend>Priority</legend>
        {[1, 2, 3].map((p) => (
          <Sq key={p} as="button" aria-pressed={f.priority.has(p)} on={f.priority.has(p)} pen={PRIORITY_PEN[p]}
            title={`Priority ${p}`} onClick={() => onChange({ ...f, priority: toggle(f.priority, p) })}>P{p}</Sq>
        ))}
      </fieldset>

      <fieldset className="fieldset">
        <legend>Effort</legend>
        {["L", "M", "H"].map((e) => (
          <Sq key={e} as="button" aria-pressed={f.effort.has(e)} on={f.effort.has(e)} pen={EFFORT_PEN[e]}
            onClick={() => onChange({ ...f, effort: toggle(f.effort, e) })}>{e}</Sq>
        ))}
      </fieldset>

      <fieldset className="fieldset" style={{ position: "relative" }}>
        <legend>Status</legend>
        <button type="button" style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 2, fontSize: 13 }}
          onClick={() => setOpenMenu(openMenu === "status" ? null : "status")}>
          {f.status ? <Stat tone={STATUS_TONE[f.status]}>{f.status}</Stat> : <Stat tone="muted">any</Stat>}<Caret />
        </button>
        {openMenu === "status" && (
          <div style={{ ...menu, flexDirection: "column", minWidth: "7.5rem", flexWrap: "nowrap" }}>
            <button type="button" className="stat stat--muted" style={{ textAlign: "left" }}
              onClick={() => { onChange({ ...f, status: null }); setOpenMenu(null); }}>any</button>
            {["backlog", "blocked", "wip", "held", "built", "shipped"].map((s) => (
              <button key={s} type="button" className={`stat stat--${STATUS_TONE[s]}`} style={{ textAlign: "left" }}
                onClick={() => { onChange({ ...f, status: f.status === s ? null : s }); setOpenMenu(null); }}>{s}</button>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="fieldset" style={{ gap: 12 }}>
        <legend>Also show</legend>
        <label style={check}><input type="checkbox" style={{ accentColor: "var(--pen-blue)" }}
          checked={f.showInternal} onChange={(e) => onChange({ ...f, showInternal: e.target.checked })} />Internal</label>
        <label style={check}><input type="checkbox" style={{ accentColor: "var(--pen-blue)" }}
          checked={f.showArchived} onChange={(e) => onChange({ ...f, showArchived: e.target.checked })} />Archived</label>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Unsorted order</legend>
        <select className="paper-field" style={{ height: "1.75rem", padding: "0 6px", fontSize: 12.5 }}
          value={f.inboxSort} onChange={(e) => onChange({ ...f, inboxSort: e.target.value })} aria-label="Unsorted order">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          <option value="id-asc"># ascending</option><option value="id-desc"># descending</option>
        </select>
      </fieldset>

      {filtering && (
        <button type="button" className="paper-link" style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12.5 }}
          onClick={() => onChange({ ...f, query: "", tags: new Set(), priority: new Set(), effort: new Set(), status: null })}>
          Clear filters
        </button>
      )}
    </div>
  );
}

/** One lane's column: the divider tab, its tools, and the cards filed in it. */
function LaneColumn({ lane, cards, view, onView, pinned, onPin, onAdd }) {
  const drawer = lane.kind === "inbox";
  if (view === "min") {
    return (
      <PaperLane kind={lane.kind} collapsed
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0", flex: "none", alignSelf: "stretch" }}>
        <h2 className="lane-name" style={{ color: LANE_INK[lane.kind] }}>{lane.name}</h2>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-grey-faint)" }}>{cards.length}</span>
        <button type="button" style={{ flex: 1, alignSelf: "stretch" }} aria-label={`Expand ${lane.name}`} onClick={() => onView("")} />
      </PaperLane>
    );
  }
  return (
    <PaperLane kind={lane.kind} width={view === "max" ? "max" : "default"}
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, flex: "none", alignSelf: "stretch" }}>
      <LaneHead name={lane.name} kind={lane.kind} count={String(cards.length)} sla={lane.sla}
        tools={<>
          {lane.kind !== "archive" && <button type="button" className="lane-tool" title={`Add card to ${lane.name}`} onClick={onAdd}><Icon name="plus" size={14} /></button>}
          <button type="button" className="lane-tool" title="Manage lane"><Icon name="more-horizontal" size={13} /></button>
          <button type="button" className="lane-tool" title={view === "max" ? "Restore" : "Maximize"} onClick={() => onView(view === "max" ? "" : "max")}><Icon name="maximize-2" size={13} /></button>
          <button type="button" className="lane-tool" title="Minimize" onClick={() => onView("min")}><Icon name="minus" size={13} /></button>
        </>} />
      <div style={{ display: "flex", minHeight: 160, flex: 1, flexDirection: "column", gap: drawer ? 0 : 8, overflowY: "auto" }}>
        {cards.map((c) => (
          <div key={c.id} style={{ padding: "0 var(--card-gutter)" }} data-id={c.id}>
            <CardFace card={c} flat={drawer} pinned={pinned.has(c.id)} onPin={onPin} />
          </div>
        ))}
      </div>
    </PaperLane>
  );
}

/** The kanban: letterhead, filter bar, lanes in position order. */
function BoardScreen({ data, onView, view }) {
  const [f, setF] = React.useState({ query: "", tags: new Set(), priority: new Set(), effort: new Set(), status: null, showInternal: true, showArchived: false, inboxSort: "oldest" });
  const [openMenu, setOpenMenu] = React.useState(null);
  const [views, setViews] = React.useState({});
  const [pinned, setPinned] = React.useState(new Set());
  const [cards, setCards] = React.useState(data.cards);
  const onPin = (id, on) => setPinned((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const q = f.query.trim().toLowerCase();
  const visible = (c) =>
    (!q || c.title.toLowerCase().includes(q) || `#${c.id}`.includes(q)) &&
    (!f.priority.size || f.priority.has(c.priority)) &&
    (!f.effort.size || f.effort.has(c.effort)) &&
    (!f.status || c.status === f.status) &&
    (!f.tags.size || (c.tags || []).some((t) => f.tags.has(t.name)));
  const shown = cards.filter(visible);
  const open = shown.filter((c) => !["done", "shipped"].includes(c.status)).length;
  const unsorted = shown.filter((c) => c.lane === "unsorted").length;
  const addCard = (laneKey) => {
    const id = String(Math.max(...cards.map((c) => Number(c.id))) + 1);
    setCards([{ id, lane: laneKey, title: "Untitled card", epic: null, status: "backlog", raised: "today", tags: [] }, ...cards]);
  };
  return (
    <main style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px 24px", padding: "20px 24px 14px" }}>
        <div>
          <Eyebrow><a href="#" onClick={(e) => { e.preventDefault(); onView("project"); }}>{data.project.name}</a></Eyebrow>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 14px" }}>
            <h1 style={{ fontSize: 27 }}>{data.board.name}</h1>
            <span style={{ fontSize: 12.5, color: "var(--color-grey)" }}>
              <b style={{ color: "var(--color-ink)" }}>{open}</b> open · <b style={{ color: "var(--color-ink)" }}>{unsorted}</b> unsorted
            </span>
          </div>
          <ViewLinks view={view} onView={onView} items={[["cockpit", "Epic Cockpit"], ["calendar", "Calendar"], ["timeline", "Timeline"], ["manage", "Manage"]]} />
        </div>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="paper-btn paper-btn--sm" onClick={() => addCard("unsorted")}>Add lane</button>
          <button type="button" className="paper-btn paper-btn--sm">Export CSV</button>
        </span>
      </header>
      <FilterBar f={f} onChange={setF} groups={data.groups} openMenu={openMenu} setOpenMenu={setOpenMenu} />
      <div style={{ display: "flex", flex: 1, minHeight: 0, alignItems: "stretch", gap: 8, overflowX: "auto", padding: "12px 24px 24px" }}>
        {data.lanes.map((lane) => (
          <LaneColumn key={lane.key} lane={lane} view={views[lane.key] || ""}
            onView={(v) => setViews({ ...views, [lane.key]: v })}
            cards={shown.filter((c) => c.lane === lane.key)}
            pinned={pinned} onPin={onPin} onAdd={() => addCard(lane.key)} />
        ))}
      </div>
    </main>
  );
}

Object.assign(window, { BoardScreen, FilterBar, LaneColumn, Caret });
