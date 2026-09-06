import React from "react";
import { PaperCard } from "../stock/PaperCard";
import { EpicLabel } from "../marks/EpicLabel";
import { Mark } from "../marks/Mark";
import { Sq } from "../marks/Sq";
import { Stat } from "../marks/Stat";
import { Icon } from "../icon/Icon";

const STATUS_TONE = {
  wip: "wip",
  built: "info",
  handed: "info",
  held: "muted",
  blocked: "blocked",
  shipped: "success",
  done: "success",
  backlog: "muted",
};

const PRIORITY_PEN = { 1: "red", 2: "blue", 3: "violet" };
const EFFORT_PEN = { L: "green", M: "amber", H: "red" };

/**
 * The board card. Resting chrome is `#id`, the title, the epic, the status
 * word and the decisions already made; the rest — tags, dates, the note —
 * is the back of the card and opens on hover after the dwell, while the
 * resting summary steps aside on the same clock.
 */
export function BoardCard({
  id,
  title,
  epic,
  status = "backlog",
  raised,
  signal = null,
  priority = null,
  effort = null,
  tags = [],
  note,
  needs,
  days,
  overSla = false,
  tint = null,
  variant = "resting",
  pinned = false,
  rail = true,
  className = "",
  ...rest
}) {
  const chips = (priority || effort) && (
    <span className="card-meta-chips" style={{ display: "flex", flexShrink: 0, gap: "0.25rem" }}>
      {priority && (
        <Sq on pen={PRIORITY_PEN[priority]} title={`Priority ${priority}`}>
          P{priority}
        </Sq>
      )}
      {effort && (
        <Sq on pen={EFFORT_PEN[effort]} title="Effort">
          {effort}
        </Sq>
      )}
    </span>
  );
  return (
    <PaperCard
      {...rest}
      as="article"
      variant={variant}
      tint={tint}
      pinned={pinned}
      signal={signal}
      className={`${className}`.trim()}
      style={{ padding: "0.625rem", position: "relative", ...rest.style }}
    >
      {rail && variant !== "overlay" && (
        <div className="card-rail">
          <button type="button" aria-label="Pin card" data-on={pinned ? "true" : undefined}>
            <Icon name="pin" size={13} />
          </button>
          <a href="#" aria-label="Open in place">
            <Icon name="maximize-2" size={13} />
          </a>
          <button type="button" className="card-color-trigger" aria-label="Card colour">
            <Icon name="palette" size={13} />
          </button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", paddingRight: "1.5rem" }}>
        <span
          style={{
            flexShrink: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-id)",
            color: "var(--color-grey-faint)",
          }}
        >
          #{id}
        </span>
        <p style={{ minWidth: 0, fontSize: "var(--text-title)", fontWeight: 500, lineHeight: 1.3 }}>{title}</p>
      </div>

      <div
        className="card-meta"
        style={{
          marginTop: "0.25rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.25rem 0.5rem",
        }}
      >
        {epic && <EpicLabel name={epic} />}
        {status !== "backlog" && <Stat tone={STATUS_TONE[status] || "muted"}>{status}</Stat>}
        {signal === "forgotten" && <Stat tone="blocked">forgotten</Stat>}
        {signal === "overdue" && <Stat tone="blocked">overdue</Stat>}
      </div>

      {(raised || chips) && (
        <div className="card-rest">
          <div className="card-rest-inner">
            <div
              className="card-meta"
              style={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              {raised && (
                <span className="card-age" data-signal={signal || "active"}>
                  <Icon name="calendar-clock" size={13} className="card-age__icon" />
                  <span className="card-age-date">{raised}</span>
                </span>
              )}
              {chips}
            </div>
          </div>
        </div>
      )}

      <div className="card-peek">
        <div className="card-peek-inner">
          <div
            className="card-peek-actions card-meta"
            style={{
              marginTop: "0.375rem",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.25rem 0.5rem",
            }}
          >
            {days != null && <Stat tone={overSla ? "blocked" : "muted"}>{days}d</Stat>}
            {needs && <Stat tone="attention">waiting · {needs}</Stat>}
          </div>
          <section
            className="card-form"
            style={{
              marginTop: "0.625rem",
              borderTop: "1px solid var(--border-hairline)",
              paddingTop: "0.625rem",
            }}
            aria-label="Card fields"
          >
            {note && (
              <>
                <span className="field-label">Note</span>
                <p style={{ fontSize: "var(--text-base)", lineHeight: 1.3, color: "var(--color-ink2)" }}>{note}</p>
              </>
            )}
            {tags.length > 0 && (
              <>
                <span className="field-label">Tags</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem 0.375rem" }}>
                  {tags.map((t) => (
                    <Mark key={t.name} hue={t.hue}>
                      {t.name}
                    </Mark>
                  ))}
                </div>
              </>
            )}
            <div className="card-ratings">
              <span className="field-label">Effort</span>
              <span className="card-ratings-sqs">
                {["L", "M", "H"].map((e) => (
                  <Sq key={e} on={effort === e} pen={EFFORT_PEN[e]}>
                    {e}
                  </Sq>
                ))}
              </span>
              <span className="field-label">Priority</span>
              <span className="card-ratings-sqs">
                {[1, 2, 3].map((p) => (
                  <Sq key={p} on={priority === p} pen={PRIORITY_PEN[p]}>
                    P{p}
                  </Sq>
                ))}
              </span>
            </div>
          </section>
        </div>
      </div>
    </PaperCard>
  );
}
