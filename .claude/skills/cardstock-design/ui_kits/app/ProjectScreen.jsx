const { Stamp, Icon, Mark, Stat } = window.CardstockDesignSystem_acd70a;

const MICRO = [
  { name: "Unsorted", kind: "inbox", cells: [{ signal: "queued" }, { signal: "queued" }, { signal: "queued" }] },
  { name: "Now", kind: "work", cells: [{ signal: "moving" }, { signal: "late" }, { signal: "moving" }] },
  { name: "Next", kind: "work", cells: [{ tint: "blue" }, { signal: "queued" }] },
  { name: "Later", kind: "work", cells: [{ signal: "vacant" }] },
  { name: "Nice-to-have", kind: "work", cells: [{ signal: "queued" }] },
  { name: "Parked", kind: "work", cells: [{ signal: "queued" }] },
  { name: "Needs input", kind: "waiting", cells: [{ signal: "blocked" }] },
  { name: "Built", kind: "built", cells: [{ signal: "moving" }] },
  { name: "Done", kind: "done", cells: [{ signal: "delivered" }] },
  { name: "Archive", kind: "archive", cells: [{ signal: "vacant" }] },
];

/**
 * The project page: a letterhead, then one quiet section folder per chapter —
 * boards, people, concepts, settings. Binders live only in Boards.
 */
function ProjectScreen({ data, onView }) {
  const go = (e, v) => { e.preventDefault(); onView(v); };
  return (
    <main style={{ margin: "0 auto", width: "100%", maxWidth: "64rem", padding: "32px 24px 48px" }}>
      <header className="letterhead">
        <div>
          <h1>{data.project.name}</h1>
          <p className="cta-body">{data.project.blurb}</p>
          <nav style={{ display: "flex", gap: "0.9rem", marginTop: "0.6rem", fontSize: 12.5 }}>
            <a href="#" className="paper-link" onClick={(e) => e.preventDefault()}>Calendar</a>
            <a href="#" className="paper-link" onClick={(e) => go(e, "projects")}>← All projects</a>
          </nav>
        </div>
        <div className="letterhead-aside"><Stamp>{data.cards.length} cards<br />filed</Stamp></div>
      </header>

      <section className="folder folder--section">
        <span className="folder-tab"><h2>boards</h2><span className="folder-tab-dot">·</span><span className="folder-count">2</span></span>
        <div className="folder-body">
          <ul className="binders" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
            <li className="binder binder--wide">
              <span className="binder-rivets" aria-hidden="true" />
              <h2 className="binder-name">
                <a href="#" className="binder-open" onClick={(e) => go(e, "board")}>{data.board.name}</a>
                <span className="binder-count">{data.cards.length} cards</span>
              </h2>
              <div className="lane-map">
                {MICRO.map((l) => (
                  <div key={l.name} className="lane-map-col" data-kind={l.kind}>
                    <div className="lane-map-pack">
                      {l.cells.map((c, i) => (
                        <span key={i} className={`lane-map-cell ${c.signal ? `lane-map-cell--${c.signal}` : ""} ${c.tint ? `card-color--${c.tint}` : ""}`.trim()} />
                      ))}
                    </div>
                    <span className="lane-map-tip">{l.name}</span>
                  </div>
                ))}
              </div>
              <div className="binder-foot">
                <span className="binder-links">
                  <a href="#" className="paper-link" style={{ fontSize: 12.5 }} onClick={(e) => go(e, "board")}>Go to Board</a>
                  <a href="#" className="paper-link" style={{ fontSize: 12.5 }} onClick={(e) => go(e, "cockpit")}>Epic Cockpit</a>
                  <a href="#" className="paper-link" style={{ fontSize: 12.5 }} onClick={(e) => e.preventDefault()}>Manage</a>
                  <a href="#" className="paper-link" style={{ fontSize: 12.5 }} onClick={(e) => e.preventDefault()}>Export CSV</a>
                </span>
              </div>
            </li>
          </ul>
          <div className="folder-aside"><button type="button" className="paper-btn paper-btn--sm">New board</button></div>
        </div>
      </section>

      <section className="folder folder--section">
        <span className="folder-tab"><h2>people</h2><span className="folder-tab-dot">·</span><span className="folder-count">{data.people.length}</span></span>
        <div className="folder-body">
          <ul className="binders" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
            {data.people.map((p) => (
              <li key={p.email} className="binder binder--wide" style={{ minHeight: 0 }}>
                <span className="binder-rivets" aria-hidden="true" />
                <div className="roster-slip">
                  <span className="portrait" style={{ display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-grey)" }}>
                    {p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="roster-who">
                    <span className="roster-name">{p.name}{p.me && <span className="roster-you">you</span>}</span>
                    <span className="roster-mail">{p.email}</span>
                  </span>
                  <span className="roster-meta"><Stat tone={p.role === "owner" ? "ink" : "muted"}>{p.role}</Stat></span>
                </div>
              </li>
            ))}
            <li className="binder binder--wide" style={{ minHeight: 0 }}>
              <span className="binder-rivets" aria-hidden="true" />
              <div className="roster-slip roster-slip--blank">
                <div className="roster-invite">
                  <span className="roster-invite-kicker">invite</span>
                  <p className="roster-invite-lead">Recording the address sends no email — share the app URL and they choose a password on their first visit.</p>
                  <div className="roster-fields">
                    <label>Email<input type="email" placeholder="them@company.com" /></label>
                    <label>Name<input type="text" placeholder="Optional" /></label>
                    <label>Role<select><option>member</option><option>admin</option></select></label>
                    <button type="button" className="roster-invite-go">Add to project</button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="folder folder--section">
        <span className="folder-tab"><h2>concepts</h2><span className="folder-tab-dot">·</span><span className="folder-count">{data.groups.length}</span></span>
        <div className="folder-body">
          <div className="graph" style={{ gridColumn: "1 / -1" }}>
            <p className="graph-caption">A board thinks in concepts. The tags a card can carry branch from each one; hue belongs to the group, in board order.</p>
            <div className="graph-rows">
              {data.groups.map((g) => (
                <div key={g.name} className="graph-row">
                  <div className={`graph-node graph-node--${g.hue}`}>
                    <span className="graph-node-name">{g.name}</span>
                    <span className="graph-key">{g.name.toLowerCase()}</span>
                    <span className="graph-tools">
                      <button type="button" title="Rename"><Icon name="pencil" size={12} /></button>
                      <button type="button" data-danger title="Remove"><Icon name="trash-2" size={12} /></button>
                    </span>
                  </div>
                  <span className="graph-edge" aria-hidden="true" />
                  <div className="graph-leaves">
                    {g.tags.map((t) => (
                      <div key={t} className="graph-leaf">
                        <Mark hue={g.hue}>{t}</Mark>
                        <span className="graph-tools">
                          <button type="button" title="Rename"><Icon name="pencil" size={12} /></button>
                        </span>
                      </div>
                    ))}
                    <div className="graph-leaf graph-leaf--new">
                      <input className="paper-field" placeholder="new tag" style={{ width: "9rem", fontSize: 12 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="folder folder--section">
        <span className="folder-tab"><h2>settings</h2></span>
        <div className="folder-body">
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="cta">
              <div>
                <h3 className="cta-title">Take the folder home</h3>
                <p className="cta-body">Download every card as the markdown sheet it came from — lane, rank, priority, effort and target written back into the frontmatter.</p>
              </div>
              <button type="button" className="paper-btn cta-button">Download sheets</button>
              <span className="cta-note">zip · {data.cards.length} sheets</span>
            </div>
            <div className="danger" style={{ marginTop: 16 }}>
              <div>
                <h3 className="cta-title">Delete this project</h3>
                <p className="cta-body">Boards, lanes, cards and history go with it. The sheets in git do not.</p>
              </div>
              <button type="button" className="paper-btn cta-button cta-button--danger">Delete project</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

Object.assign(window, { ProjectScreen });
