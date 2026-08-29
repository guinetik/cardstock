import Link from "next/link";
import { cardColorModifier, laneColorModifier } from "@/lib/card-color";
import { LANE_MAP_SIGNAL, type LaneMicrocosmRow } from "@/lib/lane-map";

/**
 * Miniature board on a binder: one row of vertical lanes, three cards to a
 * row inside each. Untinted slips use the cockpit signal pens; a card's own
 * tint wins. Names live in an absolutely positioned tip; the binder title
 * stays the keyboard path. The link opens the board.
 */
export function LaneMap({
  href,
  rows,
}: {
  href: string;
  rows: LaneMicrocosmRow[];
}) {
  if (rows.length === 0) return null;
  const summary = rows.map((row) => `${row.name} ${row.count}`).join(", ");
  return (
    <Link href={href} className="lane-map" aria-label={summary} tabIndex={-1}>
      {rows.map((row) => (
        <span
          key={row.id}
          className={`lane-map-col ${laneColorModifier(row.color) ?? ""}`}
          data-kind={row.kind}
        >
          <span className="lane-map-tip" aria-hidden="true">
            {row.name} · {row.count}
          </span>
          <span className="lane-map-pack">
            {row.vacant ? (
              <i className="lane-map-cell lane-map-cell--vacant" />
            ) : (
              row.slips.map((slip, i) => {
                const tint = slip.color ? cardColorModifier(slip.color) : null;
                return (
                  <i
                    // biome-ignore lint/suspicious/noArrayIndexKey: occupancy ticks have no identity
                    key={i}
                    className={
                      tint
                        ? `lane-map-cell ${tint}`
                        : `lane-map-cell ${LANE_MAP_SIGNAL[slip.signal]}`
                    }
                  />
                );
              })
            )}
          </span>
        </span>
      ))}
    </Link>
  );
}
