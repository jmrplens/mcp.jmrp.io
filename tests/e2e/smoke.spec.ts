import { expect, test } from "@playwright/test";

test("la raíz responde y tiene título", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("MCP servers");
});
