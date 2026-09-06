import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

test("a signed-in member approves a one-time CLI login", async ({ page }) => {
  const start = await fetch("http://localhost:3000/api/v1/cli/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceName: "Playwright CLI" }),
  });
  expect(start.status).toBe(200);
  const request = (await start.json()) as {
    deviceCode: string;
    verificationUriComplete: string;
  };

  await signIn(page);
  await page.goto(request.verificationUriComplete);
  await page.getByRole("button", { name: "Approve Cardstock CLI" }).click();
  await expect(
    page.getByRole("heading", { name: "CLI approved" }),
  ).toBeVisible();

  const poll = await fetch("http://localhost:3000/api/v1/cli/login/poll", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceCode: request.deviceCode }),
  });
  expect(poll.status).toBe(200);
  const credential = (await poll.json()) as { token: string; email: string };
  expect(credential.email).toBeTruthy();
  expect(credential.token).toMatch(/^cst_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);

  const replay = await fetch("http://localhost:3000/api/v1/cli/login/poll", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceCode: request.deviceCode }),
  });
  expect(replay.status).toBe(204);
});
