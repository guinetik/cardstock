import { CALENDAR, UNSCHEDULED } from "./demo";

/**
 * A month of target dates, drawn the way the real calendar draws one: square
 * days, slips pinned on them, and a tray beside it holding everything with no
 * date yet. Static, so nothing here can be dragged.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// September 2026 starts on a Tuesday and runs 30 days, so the grid opens with
// one blank and closes with three.
const LEADING_BLANKS = 1;
const DAYS = 30;

export function MockCalendar() {
  return (
    <div className="flex flex-wrap items-stretch gap-3.5">
      <div className="calendar-grid min-w-0 flex-1 basis-[420px]">
        {WEEKDAYS.map((label) => (
          <div key={label} className="calendar-dow">
            {label}
          </div>
        ))}
        {Array.from({ length: LEADING_BLANKS }, (_, i) => (
          <div
            key={`blank-${WEEKDAYS[i]}`}
            className="calendar-day"
            data-in-month="false"
          />
        ))}
        {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => (
          <div key={day} className="calendar-day" data-in-month="true">
            <div className="calendar-day-body">
              <span className="calendar-day-num">{day}</span>
              <div className="calendar-pack">
                {(CALENDAR[day] ?? []).map((slip) => (
                  <div
                    key={slip.id}
                    className={`paper-card paper-card--static calendar-slip calendar-slip--stub ${
                      slip.tint ? `card-color--${slip.tint}` : ""
                    }`}
                  >
                    <span className="calendar-slip-id">#{slip.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <aside className="calendar-tray min-w-0 flex-1 basis-[240px]">
        <h3 className="text-[15px]">
          Unscheduled{" "}
          <span className="font-mono text-[11px] text-[var(--color-grey)]">
            {UNSCHEDULED.length}
          </span>
        </h3>
        <div className="calendar-tray-list">
          {UNSCHEDULED.map((slip) => (
            <div
              key={slip.id}
              className="paper-card paper-card--static calendar-slip"
            >
              <div className="calendar-slip-open">
                <span className="calendar-slip-id">#{slip.id}</span>
              </div>
              <p className="calendar-slip-title calendar-slip-title--full">
                {slip.title}
              </p>
              <p className="calendar-slip-board">{slip.board}</p>
            </div>
          ))}
        </div>
        <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--color-grey-faint)]">
          everything with no date yet
        </p>
      </aside>
    </div>
  );
}
