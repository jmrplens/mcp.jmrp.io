import { expect, test } from "@playwright/test";

import { serverCards } from "../../src/data/server-cards";

/**
 * The cards' folds, and what replaced them.
 *
 * tools/prompts STOPPED being folded here: that content moved to its own page,
 * `/servers/<id>/` (see `.superpowers/sdd/servers-section-spec.md`), unfolded —
 * the explicit goal of the move is more citable content, not less. What is
 * still folded on this page (per-client config, notices) is still folded
 * because the scrolling problem that motivated the folds remained real for that
 * content. What must NOT happen is folding hiding content from crawlers: the
 * native `<details>` keeps it in the HTML, and that is exactly what is pinned
 * here.
 */

test("a server's card links to /servers/<id>/ with the real counts, folding nothing", async ({
  page,
}) => {
  await page.goto("/");
  const gitlabLink = page.locator("#gitlab .server-card-link a");
  await expect(gitlabLink).toBeVisible();
  await expect(gitlabLink).toHaveAttribute("href", "/servers/gitlab/");
  // Derived from the committed card snapshot (`src/data/cards/gitlab.json`),
  // not hardcoded: `scripts/sync-server-cards.sh` replaces that file on
  // every GitLab release, so a fixed number would fail on an upstream prompt
  // addition with no real site regression — see the `card` comment in
  // ServerCard.astro for why this counts the FULL card, not the curated
  // `servers.ts` list (which has 0).
  await expect(page.locator("#gitlab .server-card-counts")).toContainText(
    String(serverCards.gitlab.prompts.length),
  );
});

test("folded content is still in the served HTML", async ({ request }) => {
  const html = await (await request.get("/")).text();
  // Two facts that are still inside folds ON THE HOME PAGE (the legal and
  // limits notices). If they are ever swapped for JS lazy loading, this goes
  // red — and rightly so: they would stop being citable.
  expect(html).toContain("third-party public indexes");
  expect(html).toContain("no SLA");
});

test("a page's tools are not folded: they read without opening anything", async ({
  request,
}) => {
  // The opposite of the previous test, on purpose: `get_details` used to live
  // inside a folded <details> on the home page; on its own page it is running
  // text, and does not even need the "present but not visible" trick a closed
  // <details> required.
  const html = await (await request.get("/servers/libgen/")).text();
  expect(html).toContain("get_details");
});

test("a remaining fold's summary is reachable by keyboard and has a touch target", async ({
  page,
}) => {
  await page.goto("/");
  // Not `.fold-client`: the client snippets moved to /servers/{id}/, so that
  // fold no longer exists here. What this test is about is the affordance,
  // not one particular fold — so it takes whichever one the home page still
  // has (legal, limits, security), all of which arrive closed.
  const client = page.locator("details.fold").first();
  await expect(client).not.toHaveAttribute("open", /.*/);

  const summary = client.locator("summary");
  const box = await summary.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);

  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(client).toHaveAttribute("open", /.*/);
});

test("the token notice arrives CLOSED but opens; the reassurance never without the caveats", async ({
  page,
}) => {
  await page.goto("/");
  // These notices used to start open, so the caveat sat in view next to the
  // reassurance. The author asked for them closed: the trade-off is that the
  // warning is one click away, so what is watched now is that the click works
  // and that the content is still whole — folded is not the same as absent.
  const security = page.locator("details.fold-security").first();
  await expect(security).not.toHaveAttribute("open", /.*/);
  await security.locator("summary").click();
  await expect(security).toHaveAttribute("open", /.*/);
  await expect(security.locator("li", { hasText: /read_api/ })).toBeVisible();
});
