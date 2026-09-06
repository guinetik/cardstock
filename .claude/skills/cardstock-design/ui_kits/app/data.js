// Demo board, matching the seed in supabase/seed.sql and the screenshots in
// the cardstock repo. Lane kinds — not names — drive behaviour.
window.CS_DATA = {
  project: { slug: "demo", name: "Demo", blurb: "A project is a collection of boards. A board is where cards go to be worked; its epic cockpit is where you take stock." },
  board: { slug: "backlog", name: "Product backlog" },
  groups: [
    { name: "Area", hue: 2, tags: ["Billing", "Onboarding", "Reports", "Cross-cutting"] },
    { name: "Step", hue: 4, tags: ["Spec", "Build", "QA"] },
    { name: "Kind", hue: 3, tags: ["Bug", "Feature", "Chore"] },
    { name: "Objective", hue: 5, tags: ["Retention", "Trust"] },
  ],
  lanes: [
    { key: "unsorted", name: "Unsorted", kind: "inbox" },
    { key: "now", name: "Now", kind: "work" },
    { key: "next", name: "Next", kind: "work" },
    { key: "later", name: "Later", kind: "work" },
    { key: "nice", name: "Nice-to-have", kind: "work" },
    { key: "parked", name: "Parked", kind: "work" },
    { key: "needs", name: "Needs input", kind: "waiting", sla: 5 },
    { key: "built", name: "Built", kind: "built" },
    { key: "done", name: "Done", kind: "done" },
  ],
  cards: [
    { id: "11", lane: "unsorted", title: "Search results page loads slowly with many filters", epic: "Reports", status: "backlog", raised: "Aug 13", signal: "forgotten", tags: [{ name: "Reports", hue: 2 }, { name: "Bug", hue: 3 }], note: "Ten filters on, the page takes eleven seconds." },
    { id: "12", lane: "unsorted", title: "Team members can be invited by email from Settings", epic: "Cross-cutting", status: "backlog", raised: "Aug 14", signal: "forgotten", tags: [{ name: "Cross-cutting", hue: 2 }, { name: "Feature", hue: 3 }] },
    { id: "13", lane: "unsorted", title: "Onboarding checklist forgets progress after sign-out", epic: "Onboarding", status: "backlog", raised: "Aug 15", signal: "forgotten", tags: [{ name: "Onboarding", hue: 2 }, { name: "Bug", hue: 3 }] },
    { id: "1", lane: "now", title: "Sign-up form loses what you typed when the email is invalid", epic: "Onboarding", status: "backlog", raised: "Aug 1", signal: "forgotten", priority: 1, effort: "L", tags: [{ name: "Onboarding", hue: 2 }, { name: "Bug", hue: 3 }, { name: "Trust", hue: 5 }], note: "Validation clears the whole form, not just the bad field." },
    { id: "2", lane: "now", title: "Invoice PDF shows the wrong currency for EU customers", epic: "Billing", status: "backlog", raised: "Aug 3", priority: 1, effort: "M", tags: [{ name: "Billing", hue: 2 }, { name: "Bug", hue: 3 }], note: "Every invoice renders in USD regardless of the account." },
    { id: "6", lane: "now", title: "Export any report as CSV", epic: "Reports", status: "wip", raised: "Aug 8", signal: "forgotten", priority: 2, effort: "L", tags: [{ name: "Reports", hue: 2 }, { name: "Feature", hue: 3 }], note: "As long as I can slice it and dice it." },
    { id: "10", lane: "next", title: "First run shows a two-minute tour", epic: "Onboarding", status: "backlog", raised: "Aug 12", priority: 1, effort: "M", tint: "blue", tags: [{ name: "Onboarding", hue: 2 }, { name: "Retention", hue: 5 }] },
    { id: "3", lane: "next", title: "Weekly report can be scheduled to email itself", epic: "Reports", status: "backlog", raised: "Aug 5", signal: "forgotten", priority: 2, effort: "M", tags: [{ name: "Reports", hue: 2 }, { name: "Feature", hue: 3 }] },
    { id: "4", lane: "nice", title: "Dark mode for the whole app", epic: "Cross-cutting", status: "backlog", raised: "Aug 6", signal: "forgotten", effort: "H", tags: [{ name: "Cross-cutting", hue: 2 }] },
    { id: "9", lane: "parked", title: "Nightly build takes forty minutes", epic: "Cross-cutting", status: "held", raised: "Aug 10", effort: "M", tags: [{ name: "Chore", hue: 3 }] },
    { id: "5", lane: "needs", title: "Should trials require a card?", epic: null, status: "blocked", raised: "Aug 7", signal: "forgotten", needs: "a decision from Finance", days: 6, tags: [{ name: "Billing", hue: 2 }] },
    { id: "7", lane: "built", title: "Password reset email lands in spam", epic: "Cross-cutting", status: "built", raised: "Aug 9", effort: "L", tags: [{ name: "Cross-cutting", hue: 2 }, { name: "QA", hue: 4 }] },
    { id: "8", lane: "done", title: "Board loads under a second with 400 cards", epic: "Reports", status: "shipped", raised: "Jul 28", effort: "M", tint: "green", tags: [{ name: "Chore", hue: 3 }] },
  ],
  epics: [
    { name: "Onboarding", owner: "Ana", outcome: "A new team reaches a first board in a day.", outlook: "at-risk", delivered: 1, total: 5, blocked: 0, late: 2, commitment: "Oct 15, 2026" },
    { name: "Billing", owner: "Rafa", outcome: "Invoices are right the first time, in every currency.", outlook: "attention", delivered: 2, total: 4, blocked: 1, late: 1, commitment: "Nov 2, 2026" },
    { name: "Reports", owner: "Owner not set", outcome: "Anything on screen can be sliced and taken away.", outlook: "on-track", delivered: 3, total: 4, blocked: 0, late: 0, commitment: "Sep 30, 2026" },
    { name: "Cross-cutting", owner: "Ana", outcome: "Outcome not described yet.", outlook: "planning", delivered: 0, total: 3, blocked: 0, late: 0, commitment: "Not set" },
  ],
  people: [
    { name: "Ana Lima", email: "ana@demo.test", role: "admin", me: true },
    { name: "Rafa Costa", email: "rafa@demo.test", role: "member" },
    { name: "No name yet", email: "owner@demo.test", role: "owner" },
  ],
};
