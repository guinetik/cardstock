/**
 * Sign-in. Invite-only: an email that is not on the allowlist never gets a
 * session. Setting a password the first time is the whole onboarding — no
 * mail is involved.
 */
function LoginScreen({ onView }) {
  const [onboarding, setOnboarding] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => { setBusy(false); onView("projects"); }, 500);
  };
  return (
    <main style={{ display: "flex", minHeight: "100%", flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="paper-card paper-card--still" style={{ width: "100%", maxWidth: "24rem", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontSize: 27, lineHeight: 1.2 }}>cardstock</h1>
          <span style={{ border: "1px solid var(--border-strong)", padding: "2px 6px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.11em", color: "var(--color-grey)" }}>beta</span>
        </div>
        <p style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.45, color: "var(--color-grey)" }}>
          Invite-only while in beta. Sign in with the email you were invited with. Setting a password the first time is the whole onboarding.
        </p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 22 }}>
          <input className="paper-field" style={{ height: "2.25rem", fontSize: 13.5 }} type="email" required
            placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <input className="paper-field" style={{ height: "2.25rem", fontSize: 13.5 }} type="password" required
            placeholder={onboarding ? "Choose a password" : "Password"} aria-label="Password" />
          {onboarding && (
            <>
              <input className="paper-field" style={{ height: "2.25rem", fontSize: 13.5 }} type="text" required placeholder="Your name" aria-label="Your name" />
              <input className="paper-field" style={{ height: "2.25rem", fontSize: 13.5 }} type="password" required placeholder="Confirm password" aria-label="Confirm password" />
            </>
          )}
          <button type="submit" className="paper-btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Working…" : onboarding ? "Set password and sign in" : "Sign in"}
          </button>
        </form>
        <button type="button" onClick={() => setOnboarding((v) => !v)}
          style={{ marginTop: 20, fontSize: 12, color: "var(--color-grey)", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {onboarding ? "Already have a password? Sign in" : "First time here? Set your password"}
        </button>
      </div>
    </main>
  );
}

Object.assign(window, { LoginScreen });
