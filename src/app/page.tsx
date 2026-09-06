import type { Metadata } from "next";
import {
  BINDER_MAP,
  BOARD,
  type DemoEpic,
  DRAWER,
  EPICS,
  ROUND_TRIP_CARD,
} from "@/components/landing/demo";
import {
  InviteFormFull,
  InviteFormShort,
} from "@/components/landing/invite-form";
import { MockCalendar } from "@/components/landing/mock-calendar";
import { MockCard, MockLane } from "@/components/landing/paper-mock";
import { LandingRail } from "@/components/landing/rail";
import { LaneMap } from "@/components/lane-map";

export const metadata: Metadata = {
  title: { absolute: "cardstock" },
  description:
    "A kanban board over a markdown tracker. The files keep the story, the board keeps the decisions, and the export puts them back.",
};

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#filing", label: "Filing" },
  { href: "#calendar", label: "Calendar" },
  { href: "#not-built", label: "Not built yet" },
  { href: "#invite", label: "Ask for an invite" },
];

const METRICS = [
  { label: "one work item", value: "1 .md" },
  { label: "lanes, named by you", value: "6 lanes" },
  { label: "import and export", value: "450 ms" },
  { label: "every corner", value: "2 px" },
];

const NOT_BUILT = [
  {
    tone: "stat--blocked",
    tag: "not built",
    text: "Resetting a forgotten password. It needs mail this app does not send yet, so the owner does it by hand.",
  },
  {
    tone: "stat--muted",
    tag: "off",
    text: "Spring-loaded lanes. They were built, then switched off: they fired while you were only passing over a lane on the way somewhere else.",
  },
  {
    tone: "stat--wip",
    tag: "v1.1",
    text: "Attachments. The schema holds them. The interface for adding one does not exist.",
  },
  {
    tone: "stat--muted",
    tag: "desk only",
    text: "A phone. The board assumes a pointer and a wide screen, and the calendar assumes both.",
  },
];

const SECTION = "px-[clamp(20px,4vw,52px)] pt-[clamp(38px,4.5vw,64px)]";
const LEAD =
  "mt-3 max-w-[56ch] text-[15px] leading-relaxed text-[var(--color-ink2)]";
const H2 = "mt-2.5 max-w-[26ch] text-[clamp(22px,2.7vw,28px)]";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-wrap items-start bg-[var(--surface-page)]">
      <LandingRail />
      <main className="flex min-w-0 flex-1 basis-[560px] flex-col overflow-hidden">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--border-divider)] bg-[var(--surface-topbar)] px-[clamp(20px,4vw,52px)] py-3.5">
          <span className="eyebrow">The zen of project management</span>
          <span className="hidden items-center gap-4 text-[12.5px] md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="paper-link">
                {item.label}
              </a>
            ))}
          </span>
        </nav>

        {/* ------------------------------------------------------------ hero */}
        <div className="px-[clamp(20px,4vw,52px)] pt-[clamp(28px,4vw,52px)]">
          <p className="eyebrow">
            markdown in git · a board on top · invite only
          </p>
          <h1 className="mt-3.5 max-w-[22ch] text-[clamp(30px,4.4vw,48px)] leading-[1.06]">
            Keep writing markdown. Read it as a board.
          </h1>
          <p className="mt-4.5 max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-ink2)]">
            One file per work item, kept in git where your team already writes.
            cardstock reads the sheets in, the review moves them into lanes and
            puts a priority and a size on them, and the export writes those
            decisions back into the same files. Markdown owns the narrative. The
            app owns the margin.
          </p>
          <div className="mt-[22px] flex flex-wrap items-center gap-3">
            <a href="#invite" className="paper-btn">
              Ask for an invite
            </a>
            <a href="#how" className="paper-btn paper-btn--outline">
              See how it works
            </a>
            <span className="font-mono text-[10.5px] tracking-[0.05em] text-[var(--color-grey-faint)]">
              invites go out in small batches
            </span>
          </div>
        </div>

        {/* ------------------------------------------- the board, mid review */}
        <div className="mt-[clamp(24px,3vw,38px)] border-y border-[var(--border-hairline)] bg-[var(--surface-page)] pl-[clamp(20px,4vw,52px)]">
          <p className="eyebrow block pt-3">a board, mid review</p>
          <div className="grid h-[452px] auto-cols-[280px] grid-flow-col items-stretch gap-[3px] overflow-x-auto py-3">
            {BOARD.map((lane) => (
              <MockLane key={lane.name} lane={lane} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap border-b border-[var(--border-hairline)] bg-[var(--surface-panel)]">
          {METRICS.map((metric, i) => (
            <div
              key={metric.label}
              className={`flex-1 basis-[160px] px-5 py-4 ${
                i === 0 ? "pl-[clamp(20px,4vw,52px)]" : ""
              } ${i < METRICS.length - 1 ? "border-r border-[var(--border-divider)]" : ""}`}
            >
              <p className="field-label">{metric.label}</p>
              <p className="mt-1.5 font-mono text-[19px] text-[var(--color-ink)]">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        {/* ------------------------------------------- 01 file and app */}
        <section id="how" className={SECTION}>
          <p className="eyebrow">01 · the round trip</p>
          <h2 className={H2}>
            The file keeps the story. The board keeps the decisions.
          </h2>
          <p className={LEAD}>
            You write the item: what it is, who asked for it, why it matters.
            The board records what the review decided about it, and the export
            writes those lines back into the same file. The folder in git stays
            the copy you can read on a train with no network.
          </p>
          <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(258px,1fr))] items-start gap-4">
            <div>
              <p className="eyebrow mb-2 block">the file in git</p>
              <div className="paper-card paper-card--still px-4 py-3.5">
                <pre className="m-0 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-[var(--color-ink2)]">{`---
id: 42
title: Round trip loses the target date
epic: Round trip
raised: 2026-08-01
tags: [etl, bug]
---
Reproduced on the client board. The exporter
writes the lane and the rank and drops target.`}</pre>
                <div className="mt-3 border-t border-dashed border-[var(--border-strong)] pt-3">
                  <pre className="m-0 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-[var(--pen-green)]">{`+ lane: now
+ rank: 3
+ priority: 1
+ effort: L
+ target: 2026-09-15`}</pre>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--color-grey-faint)]">
                    added by monday&rsquo;s review, not by a person typing
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3.5">
              <div>
                <p className="eyebrow mb-2 block">the same item, filed</p>
                <MockCard card={ROUND_TRIP_CARD} />
              </div>
              <div className="flex flex-wrap gap-6 border-t border-[var(--border-hairline)] pt-3.5">
                <div className="flex flex-col gap-1.5">
                  <span className="field-label">markdown owns</span>
                  <span className="font-mono text-[12px] leading-relaxed text-[var(--color-ink2)]">
                    id · title · epic
                    <br />
                    tags · the body
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="field-label">the board owns</span>
                  <span className="font-mono text-[12px] leading-relaxed text-[var(--color-ink2)]">
                    lane · rank · priority
                    <br />
                    effort · target
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- 02 the drawer */}
        <section className={SECTION}>
          <p className="eyebrow">02 · the drawer</p>
          <h2 className={H2}>The unsorted drawer ages in public.</h2>
          <p className={LEAD}>
            Anything filed without a decision lands in one drawer, oldest at the
            top. A card that has sat there a month says so on its own face, so
            the pile cannot quietly become the backlog.
          </p>
          <div className="mt-6 flex flex-wrap items-start gap-6">
            <div className="min-w-0 max-w-[400px] flex-1 basis-[300px]">
              <MockLane
                lane={{ name: "Unsorted", drawer: true, cards: DRAWER }}
              />
            </div>
            <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-3 border-l border-[var(--border-hairline)] pl-6">
              <p className="font-heading text-[19px] leading-snug text-[var(--color-ink)]">
                &ldquo;The oldest stuff is the hardest for me to
                prioritize.&rdquo;
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--color-grey-faint)]">
                the review this drawer came out of
              </p>
              <p className="mt-0.5 text-[13.5px] leading-normal text-[var(--color-grey)]">
                It replaces the monthly scroll through a list nobody has opened
                since March, looking for the thing you already know is in there.
              </p>
              <div className="flex flex-wrap gap-x-3.5 gap-y-2 border-t border-[var(--border-hairline)] pt-3">
                <span className="stat stat--blocked">3 forgotten</span>
                <span className="stat stat--muted">oldest 34d</span>
                <span className="stat stat--ink">4 in drawer</span>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------- 03 folders and binders */}
        <section id="filing" className={SECTION}>
          <p className="eyebrow">03 · folders and binders</p>
          <h2 className={H2}>A folder holds binders. A binder holds sheets.</h2>
          <p className={LEAD}>
            A project is a folder and a board is a binder, so a shelf of work
            reads as a shelf: how many cards each one carries, who owns it, and
            which one you meant to open.
          </p>
          <ul className="folders mt-6">
            <li className="folder">
              <span className="folder-tab">
                <span>Delivery</span>
              </span>
              <div className="folder-body">
                <p className="folder-blurb">
                  One folder per team or client. Whoever owns it decides who
                  else gets a key.
                </p>
                <ul className="binders">
                  <li className="binder">
                    <span className="binder-rivets" aria-hidden="true" />
                    <h3 className="binder-name">Backlog</h3>
                    <p className="binder-count">13 cards</p>
                  </li>
                  <li className="binder binder--wide">
                    <span className="binder-rivets" aria-hidden="true" />
                    <h3 className="binder-name">Platform</h3>
                    <p className="binder-count">6 cards</p>
                    <LaneMap href="#filing" rows={BINDER_MAP} />
                  </li>
                </ul>
                <div className="folder-aside">
                  <span className="folder-stamp" aria-hidden="true">
                    13 cards
                    <br />
                    filed
                  </span>
                  <span className="folder-go paper-link">Open project →</span>
                </div>
              </div>
            </li>
          </ul>
          <p className="mt-3 font-mono text-[11.5px] text-[var(--color-grey)]">
            13 cards filed · 2 binders · 3 unsorted · 1 blocked
          </p>
        </section>

        {/* --------------------------------------------------- 04 epics */}
        <section className={SECTION}>
          <p className="eyebrow">04 · epics</p>
          <h2 className={H2}>Every epic carries its own outlook.</h2>
          <p className={LEAD}>
            An epic is a promise with a date on it. The cockpit says how much of
            it is delivered, how much is stuck and whether the target still
            holds, so nobody has to build the slide that says the same thing.
          </p>
          <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] items-start gap-3.5">
            {EPICS.map((epic) => (
              <EpicTome key={epic.name} epic={epic} />
            ))}
          </div>
          <div className="mt-[22px] flex flex-wrap items-start gap-6 border-t border-[var(--border-hairline)] pt-4.5">
            <div className="min-w-0 flex-1 basis-[240px]">
              <p className="eyebrow mb-2.5 block">filters, tags and the pen</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mark mark--2">etl</span>
                <span className="mark mark--4">board</span>
                <span className="mark mark--3">bug</span>
                <span className="mark mark--5">docs</span>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                <fieldset className="fieldset">
                  <legend>Priority</legend>
                  <span className="sq sq--on sq--red">P1</span>
                  <span className="sq">P2</span>
                  <span className="sq">P3</span>
                </fieldset>
                <fieldset className="fieldset">
                  <legend>Effort</legend>
                  <span className="sq">L</span>
                  <span className="sq sq--on sq--amber">M</span>
                  <span className="sq">H</span>
                </fieldset>
              </div>
              <p className="mt-3 text-[13px] leading-normal text-[var(--color-grey)]">
                Pen is what the app recorded. Highlighter is your own hand, and
                it only ever lands on tags.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ 05 the calendar */}
        <section id="calendar" className={SECTION}>
          <p className="eyebrow">05 · the calendar</p>
          <h2 className={H2}>Target dates, pinned to a month.</h2>
          <p className={LEAD}>
            Drag a card onto a day and it has a rough date. Drag it off and it
            has none. The tray beside the month holds everything with no date
            yet, which on most boards is most of it.
          </p>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[20px]">September 2026</h3>
            <span className="font-mono text-[11.5px] text-[var(--color-grey)]">
              6 dated · 3 in the tray
            </span>
          </div>
          <div className="mt-3">
            <MockCalendar />
          </div>
          <p className="mt-3 text-[13px] leading-normal text-[var(--color-grey)]">
            Rough dates dragged onto days. Nobody is drawing a gantt chart here.
          </p>
        </section>

        {/* ------------------------------------------------- mid-page ask */}
        <section className={SECTION}>
          <div className="paper-well flex flex-wrap items-end justify-between gap-5 p-[clamp(20px,3vw,28px)]">
            <div className="min-w-0 flex-1 basis-[300px]">
              <p className="eyebrow">invite only</p>
              <h3 className="mt-2 text-[22px]">Ask for an invite.</h3>
              <p className="mt-2 max-w-[46ch] text-[13.5px] leading-normal text-[var(--color-ink2)]">
                Leave the address you would sign in with. Invites go out in
                small batches while the beta is small enough that one person
                answers all the mail.
              </p>
            </div>
            <InviteFormShort />
          </div>
        </section>

        {/* ------------------------------------------------ 06 not built */}
        <section id="not-built" className={SECTION}>
          <p className="eyebrow">06 · the honest list</p>
          <h2 className="mt-2.5 text-[clamp(22px,2.7vw,28px)]">
            Not built yet
          </h2>
          <p className={LEAD}>
            What the tool cannot do today, in plain words, so you can decide
            before you ask for a seat rather than after.
          </p>
          <ul className="mt-5 grid max-w-[64ch] gap-0 border-t border-[var(--border-hairline)]">
            {NOT_BUILT.map((item) => (
              <li
                key={item.tag}
                className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2.5 border-b border-[var(--border-hairline)] py-3"
              >
                <span className={`stat ${item.tone} min-w-[76px] flex-none`}>
                  {item.tag}
                </span>
                <span className="min-w-0 flex-1 basis-[240px] text-[13.5px] leading-normal text-[var(--color-ink2)]">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* --------------------------------------------------- the ask */}
        <section
          id="invite"
          className="px-[clamp(20px,4vw,52px)] pb-[clamp(28px,4vw,44px)] pt-[clamp(42px,5vw,70px)]"
        >
          <div className="paper-card paper-card--still relative p-[clamp(22px,3vw,34px)]">
            <span className="folder-stamp absolute -top-3.5 right-[clamp(16px,4vw,34px)]">
              invite
              <br />
              only
            </span>
            <p className="eyebrow">invite only</p>
            <h2 className={H2}>Tell us what you would file first.</h2>
            <p className="mt-2.5 max-w-[52ch] text-[14px] leading-normal text-[var(--color-ink2)]">
              Two lines is plenty. The request that gets a seat quickest
              describes a real backlog you already keep somewhere worse.
            </p>
            <InviteFormFull />
          </div>
        </section>

        <footer className="mt-auto flex flex-wrap items-baseline justify-between gap-3 border-t border-[var(--border-hairline)] px-[clamp(20px,4vw,52px)] pb-7 pt-5">
          <span className="font-mono text-[10.5px] tracking-[0.06em] text-[var(--color-grey-faint)]">
            cardstock · gpl v3 · hosted here, or run it yourself
          </span>
          <span className="flex flex-wrap gap-4 text-[12.5px]">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="paper-link">
                {item.label}
              </a>
            ))}
          </span>
        </footer>
      </main>
    </div>
  );
}

/** One epic on the shelf, with the outlook the cockpit would give it. */
function EpicTome({ epic }: { epic: DemoEpic }) {
  const tone =
    epic.outlook === "at-risk"
      ? "stat--blocked"
      : epic.outlook === "on-track"
        ? "stat--success"
        : "stat--muted";
  return (
    <article className="paper-card paper-card--still p-3.5">
      <span className="eyebrow">
        {epic.name.toLowerCase()} · {epic.owner}
      </span>
      <h3 className="mb-1.5 mt-1 text-[18px]">{epic.name}</h3>
      <p className="text-[12.5px] leading-normal text-[var(--color-grey)]">
        {epic.goal}
      </p>
      <p className="mt-3 font-mono text-[11.5px] text-[var(--color-grey)]">
        {epic.progress}
      </p>
      <span className={`stat ${tone} mt-2`}>{epic.outlook}</span>
    </article>
  );
}
