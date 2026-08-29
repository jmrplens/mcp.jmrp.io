import { expect, test } from "@playwright/test";

test("the root responds and has a heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("MCP servers");
});
