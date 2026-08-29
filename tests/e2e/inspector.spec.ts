import { expect, test } from "@playwright/test";

import { inspector, loadButton, serverSelect } from "./helpers";

// These tests call the real production endpoint: that is deliberate, they
// validate the complete path (browser -> POST -> SSE parsing -> rendering). If
// the environment has no Internet access, export E2E_NO_NETWORK=1 to skip them.
// A CONDITIONAL skip driven by the environment, not a parked test: with no
// Internet access these tests cannot pass.
// eslint-disable-next-line playwright/no-skipped-test
test.skip(
  !!process.env.E2E_NO_NETWORK,
  "requires Internet access to mcp.jmrp.io",
);

test("tools/list against libgen returns the tools", async ({ page }) => {
  await page.goto("/inspector/");
  await serverSelect(page).selectOption("libgen");
  await loadButton(page).click();
  const out = page.getByTestId("inspector-output");
  await expect(out).toContainText("search", { timeout: 30_000 });
  await expect(out).toContainText("download");
});

test("initialize against libgen returns the protocol", async ({ page }) => {
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("libgen");
  await mcp.getByRole("button", { name: "initialize" }).click();
  await expect(page.getByTestId("inspector-output")).toContainText(
    "protocolVersion",
    { timeout: 30_000 },
  );
});

// This exercises the island, not its markup: the server renders the <select>
// and the <button> HTML, so checking they are visible would pass just as well
// with the island never hydrated (no `client:load`). Clicking and waiting for the
// response does verify that /es/ really mounts the inspector.
test("the inspector works on the Spanish page too", async ({
  page,
}) => {
  await page.goto("/es/inspector/");
  await loadButton(page).click();
  await expect(page.getByTestId("inspector-output")).toContainText("search", {
    timeout: 30_000,
  });
});
