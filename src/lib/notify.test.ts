import { describe, expect, test } from "bun:test";
import {
  cardEventNotice,
  type NotificationPrefs,
  notificationPrefs,
} from "./notify";

const on: NotificationPrefs = {
  enabled: true,
  kinds: { created: true, moved: true, commented: true },
};

describe("notificationPrefs", () => {
  test("defaults to off with every kind pre-checked for later", () => {
    expect(notificationPrefs(undefined)).toEqual({
      enabled: false,
      kinds: { created: true, moved: true, commented: true },
    });
    expect(notificationPrefs("garbage").enabled).toBe(false);
  });

  test("reads enabled and per-kind opt-outs", () => {
    const prefs = notificationPrefs({
      enabled: true,
      kinds: { moved: false },
    });
    expect(prefs.enabled).toBe(true);
    expect(prefs.kinds.moved).toBe(false);
    expect(prefs.kinds.created).toBe(true);
  });
});

describe("cardEventNotice", () => {
  const lanes = new Map([
    ["l1", "Unsorted"],
    ["l2", "Building"],
  ]);
  const ctx = {
    selfEmail: "me@x.dev",
    prefs: on,
    cardTitle: (id: string) => (id === "c1" ? "Fix signup form" : undefined),
    laneName: (id: string) => lanes.get(id),
  };

  test("stays silent when disabled, for own actions, and for muted kinds", () => {
    const event = {
      actor: "guinetik@x.dev",
      kind: "moved",
      card_id: "c1",
      payload: { to_lane: "l2" },
    };
    expect(
      cardEventNotice(event, { ...ctx, prefs: { ...on, enabled: false } }),
    ).toBeNull();
    expect(cardEventNotice({ ...event, actor: "me@x.dev" }, ctx)).toBeNull();
    expect(
      cardEventNotice(event, {
        ...ctx,
        prefs: { ...on, kinds: { ...on.kinds, moved: false } },
      }),
    ).toBeNull();
    expect(cardEventNotice({ ...event, kind: "edited" }, ctx)).toBeNull();
  });

  test("says who did what, resolving card and lane names", () => {
    const moved = cardEventNotice(
      {
        actor: "guinetik@x.dev",
        kind: "moved",
        card_id: "c1",
        payload: { to_lane: "l2" },
      },
      ctx,
    );
    expect(moved?.title).toBe("guinetik moved “Fix signup form”");
    expect(moved?.body).toBe("To Building");
    expect(moved?.tag).toBe("card:c1");

    const created = cardEventNotice(
      {
        actor: "guinetik@x.dev",
        kind: "created",
        card_id: "new-card",
        payload: { lane_id: "l1" },
      },
      ctx,
    );
    expect(created?.title).toBe("guinetik created a card");
    expect(created?.body).toBe("In Unsorted");

    const commented = cardEventNotice(
      {
        actor: "guinetik@x.dev",
        kind: "commented",
        card_id: "c1",
        payload: { preview: "lgtm, ship it" },
      },
      ctx,
    );
    expect(commented?.title).toBe("guinetik commented on “Fix signup form”");
    expect(commented?.body).toBe("lgtm, ship it");
  });
});
