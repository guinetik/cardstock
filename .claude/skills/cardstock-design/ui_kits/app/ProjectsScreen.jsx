const { Folder, Stamp, PaperLink, Icon } = window.CardstockDesignSystem_acd70a;

/**
 * The projects page: one manila dossier per project, taking a full row. The
 * tab names the project and is the way in; the binders inside name the
 * boards. Nothing is written twice.
 */
function ProjectsScreen({ data, onView }) {
  const go = (e, v) => { e.preventDefault(); onView(v); };
  return (
    <main style={{ margin: "0 auto", width: "100%", maxWidth: "64rem", padding: "32px 24px" }}>
      <header style={{ marginBottom: 32, display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px 24px" }}>
        <div style={{ maxWidth: "42rem" }}>
          <h1 style={{ fontSize: 36, lineHeight: 1 }}>Projects</h1>
          <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.3, color: "var(--color-ink2)" }}>{data.project.blurb}</p>
        </div>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="paper-btn paper-btn--sm paper-btn--outline">Import project</button>
          <button type="button" className="paper-btn paper-btn--sm">New project</button>
        </span>
      </header>

      <ul className="folders">
        <li className="folder">
          <a href="#" className="folder-tab" onClick={(e) => go(e, "project")}><span>{data.project.name}</span></a>
          <div className="folder-body">
            <p className="folder-blurb">{data.project.blurb}</p>
            <ul className="binders" aria-label="Boards in Demo">
              <li className="binder">
                <span className="binder-rivets" aria-hidden="true" />
                <h2 className="binder-name">
                  <a href="#" className="binder-open" onClick={(e) => go(e, "board")}>{data.board.name}</a>
                </h2>
                <p className="binder-count">{data.cards.length} cards</p>
                <div className="binder-foot binder-foot--tools binder-foot--stacked">
                  <span className="binder-io">
                    <button type="button" className="binder-tool" title="Manage Product backlog"><Icon name="settings" /></button>
                  </span>
                  <span className="binder-io">
                    <button type="button" className="binder-tool" title="Download as sheets"><Icon name="download" /></button>
                    <button type="button" className="binder-tool" title="Import sheets"><Icon name="upload" /></button>
                    <a href="#" className="binder-tool binder-tool--pen" onClick={(e) => go(e, "cockpit")}><Icon name="gauge" />Epic Cockpit</a>
                  </span>
                </div>
              </li>
              <li className="binder">
                <span className="binder-rivets" aria-hidden="true" />
                <h2 className="binder-name"><a href="#" className="binder-open" onClick={(e) => e.preventDefault()}>Platform</a></h2>
                <p className="binder-count">6 cards</p>
                <div className="binder-foot binder-foot--tools binder-foot--stacked">
                  <span className="binder-io">
                    <button type="button" className="binder-tool" title="Manage Platform"><Icon name="settings" /></button>
                  </span>
                  <span className="binder-io">
                    <button type="button" className="binder-tool" title="Download as sheets"><Icon name="download" /></button>
                    <a href="#" className="binder-tool binder-tool--pen" onClick={(e) => e.preventDefault()}><Icon name="gauge" />Epic Cockpit</a>
                  </span>
                </div>
              </li>
            </ul>
            <div className="folder-aside">
              <Stamp>{data.cards.length + 6} cards<br />filed</Stamp>
              <a href="#" className="folder-go paper-link" onClick={(e) => go(e, "project")}>Open project →</a>
            </div>
          </div>
        </li>

        <li className="folder folder--empty">
          <span className="folder-tab"><span>Marketing site</span></span>
          <div className="folder-body">
            <p className="folder-blurb" style={{ color: "var(--color-grey-faint)" }}>No description.</p>
            <p className="binders-empty">No boards yet — open the project to add one.</p>
            <div className="folder-aside">
              <Stamp faint>nothing<br />filed</Stamp>
              <a href="#" className="folder-go paper-link" onClick={(e) => e.preventDefault()}>Open project →</a>
            </div>
          </div>
        </li>
      </ul>
    </main>
  );
}

Object.assign(window, { ProjectsScreen });
