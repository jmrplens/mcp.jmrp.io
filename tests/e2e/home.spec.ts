import { expect, test } from "@playwright/test";

import { ui } from "../../src/i18n/ui";
import { serverCard } from "./helpers";

test("it lists both MCP servers with their endpoint", async ({ page }) => {
  await page.goto("/");
  const libgen = serverCard(page, "libgen");
  const gitlab = serverCard(page, "gitlab");
  await expect(libgen).toBeVisible();
  await expect(gitlab).toBeVisible();
  await expect(libgen).toContainText("https://mcp.jmrp.io/libgen");
  await expect(gitlab).toContainText("https://mcp.jmrp.io/gitlab");

  // Hiding that gitlab requires Authorization is a content defect. It does not
  // matter which markup tells it — it used to be a line of text, now it is a
  // badge plus a <dl>: gitlab's card has to say there is a mandatory header and
  // which one it is.
  await expect(gitlab).toContainText(ui.en.credentialsRequired);
  await expect(gitlab).toContainText("Authorization");

  // And the opposite: staying quiet about libgen asking for nothing leaves the
  // visitor hunting for credentials that do not exist.
  await expect(libgen).toContainText("No credentials required");
  await expect(libgen).not.toContainText("Authorization");
});

test("the link back to jmrp.io is absolute", async ({ page }) => {
  await page.goto("/");
  const href = await page
    .getByRole("link", { name: /jmrp\.io/ })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^https:\/\/jmrp\.io/);
});
