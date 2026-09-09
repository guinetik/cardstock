import { expect, test } from "@playwright/test";
import { admin, OWNER, signIn } from "./support/sign-in";

const local = ["localhost", "127.0.0.1"].includes(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
);
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test("priority cards keep their details, dimensions, and order across bands", async ({
  page,
}, testInfo) => {
  test.skip(!local, "Uses an isolated project on the local Supabase stack.");
  const projectId = crypto.randomUUID();
  const boardId = crypto.randomUUID();
  const laneId = crypto.randomUUID();
  const waitingId = crypto.randomUUID();
  const projectSlug = `e2e-priorities-${projectId}`;
  const path = `/p/${projectSlug}/b/planning/priorities`;
  const ids = Array.from({ length: 9 }, () => crypto.randomUUID());
  const titles = [
    "Move remaining clients onto the new database",
    "A real customer quote on the home page",
    "Clients can sign in from the marketing site",
    "The login page should ask for a username",
    "Connector hub should show the Staffeto logo",
    "Make pricing its own section with a clear explanation of every available plan",
    "Make the sign-in instructions easier to follow",
    "Update the footer links",
    "Let customers name their custom integrations",
  ];
  const check = (result: { error: { message: string } | null }) => {
    if (result.error) throw new Error(result.error.message);
  };
  try {
    check(
      await admin.from("projects").insert({
        id: projectId,
        slug: projectSlug,
        name: "Priority review",
        settings: { timeline_forgotten_after_days: 14 },
      }),
    );
    const { data: member, error } = await admin
      .from("members")
      .select("id, display_name, email")
      .eq("email", OWNER)
      .single();
    check({ error });
    check(
      await admin.from("project_members").insert({
        project_id: projectId,
        member_id: member!.id,
        role: "admin",
      }),
    );
    check(
      await admin.from("boards").insert({
        id: boardId,
        project_id: projectId,
        slug: "planning",
        name: "Website",
      }),
    );
    check(
      await admin.from("lanes").insert([
        {
          id: laneId,
          board_id: boardId,
          key: "now",
          name: "Now",
          position: 1,
          kind: "work",
        },
        {
          id: waitingId,
          board_id: boardId,
          key: "waiting",
          name: "Waiting on customer",
          position: 2,
          kind: "waiting",
          sla_days: 3,
        },
      ]),
    );
    check(
      await admin.from("cards").insert(
        ids.map((id, i) => ({
          id,
          board_id: boardId,
          external_id: String(i + 1),
          title: titles[i],
          lane_id: i === 2 ? waitingId : laneId,
          rank: i,
          priority: i < 6 ? 1 : i === 6 ? 2 : i === 7 ? 3 : null,
          priority_rank: i < 8 ? (i + 1) * 100 : null,
          status: i === 2 ? "blocked" : "wip",
          epic: "Sign-in & access",
          effort: i % 2 ? "L" : "M",
          raised_on: day(-30),
          target_date: i === 0 ? day(-4) : i === 1 || i === 2 ? null : day(7),
          target_label: i === 2 ? "Next quarter" : null,
          assignee_id: i === 0 ? member!.id : null,
          assignee: i === 0 ? member!.email : null,
          color: i === 0 ? "blue" : null,
          audience: "all",
        })),
      ),
    );
    check(
      await admin.from("card_events").insert({
        card_id: ids[2],
        actor: OWNER,
        kind: "moved",
        at: `${day(-5)}T00:00:00Z`,
        payload: { to: waitingId },
      }),
    );
    await signIn(page);
    await page.goto(path);
    const card = (i: number) =>
      page.locator(`[data-priority-card="${ids[i]}"]`);
    const band = (value: string) =>
      page.locator(`[data-priority-band="${value}"]`);
    await expect(card(0)).toBeVisible();
    await expect(card(0)).toContainText(member!.display_name || member!.email);
    await expect(card(0)).toContainText("Overdue · 4d");
    await expect(card(0)).toHaveClass(/card-color--blue/);
    await expect(card(0).locator(`time[datetime="${day(-4)}"]`)).toBeVisible();
    await expect(card(0).locator(`time[datetime="${day(-30)}"]`)).toBeVisible();
    await expect(card(1)).toContainText("No target date");
    await expect(card(1)).toContainText("Forgotten");
    await expect(card(2)).toContainText("Target Next quarter");
    await expect(card(2)).toContainText("Late · 5d in lane");
    await expect(card(2)).toContainText("blocked");
    await expect(card(2)).toContainText("Waiting on customer");
    await expect(card(8)).toContainText("Unassigned");
    const before = (await card(0).boundingBox())!;
    await card(0).hover();
    await expect
      .poll(async () => (await card(0).boundingBox())!.height)
      .toBe(before.height);
    await card(0).getByRole("link").focus();
    expect((await card(0).boundingBox())!.height).toBe(before.height);
    expect((await card(6).boundingBox())!.width).toBe(before.width);
    expect((await card(7).boundingBox())!.width).toBe(before.width);
    expect((await card(1).boundingBox())!.y).toBe(before.y);
    expect((await card(4).boundingBox())!.y).toBeGreaterThan(before.y);
    await card(0).getByRole("link").blur();
    await page.getByRole("heading", { name: "The jar", exact: true }).hover();
    await page.screenshot({
      path: testInfo.outputPath("priorities-desktop.png"),
      fullPage: true,
    });

    // Keep both ends of native HTML dragging in view; dragTo cannot scroll
    // between distant targets while preserving the source's pointer position.
    await page.setViewportSize({ width: 1800, height: 2200 });

    // Insert before a card on an earlier row, then after it. Large persisted
    // ranks catch optimistic ordering that accidentally mixes two rank scales.
    await card(5).dragTo(card(1), { targetPosition: { x: 8, y: 25 } });
    await expect(band("1").locator("h3")).toHaveText([
      titles[0],
      titles[5],
      ...titles.slice(1, 5),
    ]);
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("cards")
              .select("priority_rank")
              .eq("id", ids[5])
              .single()
          ).data?.priority_rank,
      )
      .toBe(150);
    await page.reload();
    await expect(band("1").locator("h3")).toHaveText([
      titles[0],
      titles[5],
      ...titles.slice(1, 5),
    ]);
    await card(5).dragTo(card(1), {
      targetPosition: { x: before.width - 8, y: 25 },
    });
    await expect(band("1").locator("h3")).toHaveText([
      titles[0],
      titles[1],
      titles[5],
      ...titles.slice(2, 5),
    ]);
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("cards")
              .select("priority_rank")
              .eq("id", ids[5])
              .single()
          ).data?.priority_rank,
      )
      .toBe(250);
    await page.reload();

    // The same fixed card moves from Unweighed into an empty group and back.
    await card(7).dragTo(band("desk"));
    await expect(
      band("desk").locator(`[data-priority-card="${ids[7]}"]`),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("cards")
              .select("priority")
              .eq("id", ids[7])
              .single()
          ).data?.priority,
      )
      .toBeNull();
    await page.reload();
    await card(8).dragTo(band("3"));
    await expect(
      band("3").locator(`[data-priority-card="${ids[8]}"]`),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("cards")
              .select("priority")
              .eq("id", ids[8])
              .single()
          ).data?.priority,
      )
      .toBe(3);
    await page.reload();
    await expect(band("3").locator("h3")).toHaveText([titles[8]]);

    // A long unweighed list stays on a two-row desk. Removing the only
    // note on the last page clamps the page; returning it reveals it again.
    const notes = Array.from({ length: 8 }, () => crypto.randomUUID());
    check(
      await admin.from("cards").insert(
        notes.map((id, i) => ({
          id,
          board_id: boardId,
          external_id: String(100 + i),
          title: `Unweighed idea ${i + 1}`,
          lane_id: laneId,
          rank: 100 + i,
          status: "backlog",
          audience: "all",
        })),
      ),
    );
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.reload();
    const deskNotes = band("desk").locator("[data-priority-card]");
    const pager = page.getByRole("navigation", { name: "Unweighed pages" });
    const previous = pager.getByRole("button", {
      name: "Previous unweighed page",
    });
    const next = pager.getByRole("button", { name: "Next unweighed page" });
    await expect(deskNotes).toHaveCount(4);
    await expect(pager).toContainText("1–4 of 9");
    await expect(previous).toBeDisabled();
    const slots = band("desk").locator(".priority-slot");
    const positions = await slots.evaluateAll((elements) =>
      elements.map((element) => ({
        left: (element as HTMLElement).offsetLeft,
        top: (element as HTMLElement).offsetTop,
      })),
    );
    expect(positions[1].top).toBe(positions[0].top);
    expect(positions[1].left).toBeGreaterThan(positions[0].left);
    expect(positions[2].top).toBeGreaterThan(positions[0].top);
    await page.screenshot({
      path: testInfo.outputPath("priorities-paginated.png"),
      fullPage: true,
    });
    await next.click();
    await expect(pager).toContainText("5–8 of 9");
    await next.click();
    await expect(pager).toContainText("9–9 of 9");
    await expect(deskNotes).toHaveCount(1);
    await expect(next).toBeDisabled();
    const lastNote = page.locator(`[data-priority-card="${notes[7]}"]`);
    await lastNote.dragTo(card(0), { targetPosition: { x: 8, y: 25 } });
    await expect(pager).toContainText("5–8 of 8");
    await expect(deskNotes).toHaveCount(4);
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(pager).toContainText("1–4 of 8");
    await lastNote.dragTo(band("desk"), { targetPosition: { x: 20, y: 20 } });
    await expect(pager).toContainText("9–9 of 9");
    await expect(deskNotes).toHaveCount(1);
    await expect(deskNotes).toHaveAttribute("data-priority-card", notes[7]);
    await expect(previous).toBeEnabled();
    await page.reload();
    await expect(pager).toContainText("1–4 of 9");

    for (const width of [1280, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(deskNotes).toHaveCount(2);
      await expect(pager).toContainText("1–2 of 9");
      await expect(card(0)).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: testInfo.outputPath("priorities-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto(`/p/${projectSlug}/priorities`);
    await expect(card(0).getByTitle("Board")).toHaveText("Website");
    await card(0).getByRole("link").click();
    await expect(page).toHaveURL(`/p/${projectSlug}/b/planning/c/1`);
  } finally {
    check(await admin.from("projects").delete().eq("id", projectId));
  }
});
