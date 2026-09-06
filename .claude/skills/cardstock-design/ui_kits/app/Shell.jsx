const { PaperTopbar, Portrait, Icon } = window.CardstockDesignSystem_acd70a;

/** The app chrome: the paper topbar, its wordmark, and the user menu. */
function Shell({ view, onView, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <header className="paper-topbar" style={{ display: "flex", height: "3rem", flexShrink: 0, alignItems: "center", justifyContent: "space-between", padding: "0 1rem" }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onView("projects"); }}
          style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--color-ink-strong)", textDecoration: "none" }}>
          cardstock
        </a>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
          Ana Lima
          <span className="portrait portrait--topbar" style={{ display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-grey)" }}>AL</span>
          <Icon name="chevron-down" size={13} />
        </span>
      </header>
      {children}
    </div>
  );
}

/** The row of view links every board-scoped page carries under its title. */
function ViewLinks({ view, onView, items }) {
  return (
    <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", marginTop: "0.4rem", fontSize: 12.5 }}>
      {items.map(([key, label]) => (
        <a key={key} href="#" className="paper-link"
          onClick={(e) => { e.preventDefault(); onView(key); }}
          style={key === view ? { color: "var(--color-ink)", textDecoration: "underline" } : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

Object.assign(window, { Shell, ViewLinks });
