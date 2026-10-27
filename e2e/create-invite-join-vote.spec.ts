import { test, expect, type Page } from "@playwright/test";
import { RELAY_HOST } from "./global-setup";

/**
 * M5a's E2E scope (user-confirmed, not the rest of M5): create room -> invite -> join -> idea ->
 * vote -> both browser contexts converge on the same state. Device linking, PWA install, Web
 * Push, and fork detection are out of scope here.
 *
 * Two isolated browser contexts (separate storage - separate IndexedDB/localStorage, like two
 * different devices) against one real relay process (global-setup.ts). Convergence is checked
 * via Playwright's own auto-retrying assertions with no manual reload anywhere in this file -
 * that's what actually exercises the live-updates WebSocket path end to end, not just pull().
 */

async function createIdentity(page: Page, deviceLabel: string): Promise<void> {
  await page.getByRole("button", { name: "Create a new identity" }).click();
  await page.getByLabel("Device name").fill(deviceLabel);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("I've saved these words").check();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("create room -> invite -> join -> idea -> vote -> both contexts converge", async ({ browser, baseURL }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  // `?relay=` (main.ts) seeds the relay-host preference before any session/registerDevice call
  // happens - the in-app relay-host field on the Rooms screen can't do this for a *first*
  // session (see main.ts's own doc comment on this).
  await alice.goto(`/?relay=${RELAY_HOST}`);
  await createIdentity(alice, "Alice's Phone");

  await alice.getByPlaceholder("Room name").fill("Weekend Trip");
  await alice.getByRole("button", { name: "Create", exact: true }).click();
  await expect(alice.getByRole("heading", { name: "Ideas" })).toBeVisible();

  await alice.getByRole("button", { name: "Create invite link" }).click();
  const inviteUrlInput = alice.locator("input[readonly]");
  await expect(inviteUrlInput).not.toHaveValue("");
  const inviteUrl = await inviteUrlInput.inputValue();

  // Mirrors website's "Open in browser" button (task #122): the invite link's own `linkHost`
  // is just squaddle.org's display default - the actual app serving /j/* lives at a different
  // origin, so whatever hands a user this link is responsible for pointing their browser there.
  const parsed = new URL(inviteUrl);
  const localJoinUrl = `${baseURL}${parsed.pathname}${parsed.hash}`;

  await bob.goto(localJoinUrl);
  await createIdentity(bob, "Bob's Phone"); // onboarding renders in place - the /j/* URL survives it
  await expect(bob.getByRole("heading", { name: "Ideas" })).toBeVisible();

  // --- idea + vote, converging live on both pages (no reload anywhere below) ---
  await alice.getByPlaceholder("Idea title").fill("Go camping");
  await alice.getByRole("button", { name: "Add idea" }).click();
  await expect(alice.getByText("Go camping")).toBeVisible();

  await expect(bob.getByText("Go camping")).toBeVisible({ timeout: 10_000 }); // live-updates push, not a reload

  await bob.getByRole("button", { name: "Upvote" }).click();
  await expect(bob.getByText("score: 1")).toBeVisible();
  await expect(alice.getByText("score: 1")).toBeVisible({ timeout: 10_000 });

  await alice.getByRole("button", { name: "Upvote" }).click();
  await expect(alice.getByText("score: 2")).toBeVisible();
  await expect(bob.getByText("score: 2")).toBeVisible({ timeout: 10_000 });

  // --- members list converges too ---
  await expect(alice.getByRole("listitem").filter({ hasText: "owner" })).toHaveCount(1);
  await expect(alice.getByRole("listitem").filter({ hasText: "member" })).toHaveCount(1);
  await expect(bob.getByRole("listitem").filter({ hasText: "owner" })).toHaveCount(1);
  await expect(bob.getByRole("listitem").filter({ hasText: "member" })).toHaveCount(1);

  await aliceContext.close();
  await bobContext.close();
});
