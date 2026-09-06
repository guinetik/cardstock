const { PaperCard, Stat, Mark, Sq, EpicLabel, Icon } = window.CardstockDesignSystem_acd70a;

const STATUS_TONE = { wip: "wip", built: "info", handed: "info", held: "muted", blocked: "blocked", shipped: "success", done: "success", backlog: "muted" };
const PRIORITY_PEN = { 1: "red", 2: "blue", 3: "violet" };
const EFFORT_PEN = { L: "green", M: "amber", H: "red" };

/**
 * The card face, composed exactly as src/components/board/card-item.tsx does:
 * resting chrome is #id, title, epic, status and the decisions; the back of
 * the card opens on hover after the dwell and the resting row steps aside.
 */
function CardFace({ card, flat, pinned, onPin, overlay }) {
  const chips = (card.priority || card.effort) && (
    <span className="card-meta-chips" style={{ display: "flex", flexShrink: 0, gap: "0.25rem" }}>
      {card.priority && <Sq on pen={PRIORITY_PEN[card.priority]} title={`Priority ${card.priority}`}>P{card.priority}</Sq>}
      {card.effort && <Sq on pen={EFFORT_PEN[card.effort]} title="Effort">{card.effort}</Sq>}
    </span>
  );
  return (
    <PaperCard as="article" variant={overlay ? "overlay" : flat ? "flat" : "resting"}
      tint={card.tint} pinned={pinned} signal={card.signal === "forgotten" ? "forgotten" : null}
      style={{ padding: "0.625rem", position: "relative" }}>
      {!overlay && (
        <div className="card-rail" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label={pinned ? "Unpin card" : "Pin card"} data-on={pinned ? "true" : undefined}
            onClick={() => onPin?.(card.id, !pinned)}>
            <Icon name={pinned ? "pin-off" : "pin"} size={13} />
          </button>
          <a href="#" aria-label="Open in place" onClick={(e) => e.preventDefault()}><Icon name="maximize-2" size={13} /></a>
          <button type="button" className="card-color-trigger" aria-label="Card colour"><Icon name="palette" size={13} /></button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", paddingRight: "1.5rem" }}>
        <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-grey-faint)" }}>#{card.id}</span>
        <p style={{ minWidth: 0, fontSize: 18, fontWeight: 500, lineHeight: 1.3 }}>{card.title}</p>
      </div>
      <div className="card-meta" style={{ marginTop: "0.25rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 0.5rem" }}>
        {card.epic && <EpicLabel name={card.epic} />}
        {card.status !== "backlog" && <Stat tone={STATUS_TONE[card.status]}>{card.status}</Stat>}
        {card.signal === "forgotten" && <Stat tone="blocked" title="No target past the watch window">forgotten</Stat>}
      </div>
      <div className="card-rest">
        <div className="card-rest-inner">
          <div className="card-meta" style={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="card-age" data-signal={card.signal || "active"}>
              <Icon name="calendar-clock" size={13} className="card-age__icon" />
              <span className="card-age-date">{card.raised}</span>
            </span>
            {chips}
          </div>
        </div>
      </div>
      <div className="card-peek">
        <div className="card-peek-inner">
          <div className="card-peek-actions card-meta" style={{ marginTop: "0.375rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 0.5rem" }}>
            {card.days != null && <Stat tone={card.days > 5 ? "blocked" : "muted"} title="Days in this lane">{card.days}d</Stat>}
            <span className="card-age" data-signal={card.signal || "active"}>
              <Icon name="calendar-clock" size={13} className="card-age__icon" />
              <span className="card-age-date">{card.raised}</span>
            </span>
            <button type="button" className="paper-link" style={{ fontSize: 11.5 }}>Archive</button>
          </div>
          <section className="card-form" aria-label="Card fields"
            style={{ marginTop: "0.625rem", borderTop: "1px solid var(--border-hairline)", paddingTop: "0.625rem" }}>
            <span className="field-label">Status</span>
            <select className="paper-field" defaultValue={card.status} style={{ height: "1.5rem", width: "100%", fontSize: 11.5 }} aria-label="Status">
              {["backlog", "blocked", "wip", "held", "built", "handed", "shipped", "done"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <span className="field-label">Waiting</span>
            <input className="paper-field" style={{ height: "1.5rem", width: "100%", fontSize: 11.5 }}
              placeholder="a person, a decision, another team" defaultValue={card.needs || ""} aria-label="Waiting on" />
            <span className="field-label field-label--dates">Dates</span>
            <div className="card-dates">
              <div className="card-dates-grid">
                <span className="card-date-col-label">started</span>
                <span className="card-date-col-label">target</span>
                <input type="date" className="paper-field" style={{ height: "1.5rem", width: "100%", fontFamily: "var(--font-mono)", fontSize: 11.5 }} aria-label="Planned start" />
                <input type="date" className="paper-field" style={{ height: "1.5rem", width: "100%", fontFamily: "var(--font-mono)", fontSize: 11.5 }} aria-label="Target date" />
              </div>
              <input className="paper-field" style={{ height: "1.5rem", width: "100%", fontSize: 11.5, fontStyle: "italic" }} placeholder="or a rough date — end of Q3" aria-label="Rough date" />
            </div>
            <div className="card-ratings">
              <span className="field-label">Effort</span>
              <span className="card-ratings-sqs">{["L", "M", "H"].map((e) => <Sq key={e} as="button" on={card.effort === e} pen={EFFORT_PEN[e]}>{e}</Sq>)}</span>
              <span className="field-label">Priority</span>
              <span className="card-ratings-sqs">{[1, 2, 3].map((p) => <Sq key={p} as="button" on={card.priority === p} pen={PRIORITY_PEN[p]}>P{p}</Sq>)}</span>
            </div>
            {card.note && (<><span className="field-label">Note</span>
              <p style={{ fontSize: 13, lineHeight: 1.3, color: "var(--color-ink2)" }}>{card.note}</p></>)}
            {card.tags?.length > 0 && (<><span className="field-label">Tags</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem 0.375rem" }}>
                {card.tags.map((t) => <Mark key={t.name} hue={t.hue}>{t.name}</Mark>)}
              </div></>)}
          </section>
        </div>
      </div>
    </PaperCard>
  );
}

Object.assign(window, { CardFace, PRIORITY_PEN, EFFORT_PEN, STATUS_TONE });
