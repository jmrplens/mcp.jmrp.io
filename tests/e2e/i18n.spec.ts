import { expect, test } from "@playwright/test";

import { ui } from "../../src/i18n/ui";
import { serverCard } from "./helpers";

test("/es/ serves the Spanish version", async ({ page }) => {
  await page.goto("/es/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: "Servidores MCP" }),
  ).toBeVisible();
  // The heading is not enough: an /es/ with its lede, its links or its
  // descriptions in English would still pass a test that only looks at the
  // <h1>. `lede` — the text that introduces the page — is what is checked
  // because it is what fills that slot today; before the redesign it was
  // `subtitle`.
  await expect(page.getByText(ui.es.lede)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Repositorio" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Documentación" }).first(),
  ).toBeVisible();
  // Text that comes from `src/data/servers.ts`, not from `ui.ts`: this checks
  // the page picks `description.es` and not `description.en`.
  await expect(page.getByText(/No requiere cuenta/)).toBeVisible();
  // Hiding that gitlab requires Authorization is a content defect, and in
  // Spanish it went missing once already. The header's name is not translated;
  // the label saying it is mandatory is.
  const gitlab = serverCard(page, "gitlab");
  await expect(gitlab).toContainText(ui.es.credentialsRequired);
  await expect(gitlab).toContainText("Authorization");
});

test("servers.json keeps the machine-readable index", async ({ request }) => {
  const res = await request.get("/servers.json");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { endpoints: Record<string, string> };
  expect(body.endpoints.libgen).toBe("https://mcp.jmrp.io/libgen");
  expect(body.endpoints.gitlab).toBe("https://mcp.jmrp.io/gitlab");
});
