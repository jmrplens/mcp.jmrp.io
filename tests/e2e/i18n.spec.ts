import { expect, test } from "@playwright/test";

import { ui } from "../../src/i18n/ui";
import { serverCard } from "./helpers";

test("/es/ sirve la versión en español", async ({ page }) => {
  await page.goto("/es/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: "Servidores MCP" }),
  ).toBeVisible();
  // El título no basta: una /es/ con el texto de entrada, los enlaces o las
  // descripciones en inglés seguiría pasando un test que solo mire el <h1>.
  // Se comprueba `lede` —el texto que presenta la página— porque es el que hoy
  // ocupa ese hueco; antes del rediseño era `subtitle`.
  await expect(page.getByText(ui.es.lede)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Repositorio" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Documentación" }).first(),
  ).toBeVisible();
  // Texto que viene de `src/data/servers.ts`, no de `ui.ts`: comprueba que la
  // página elige `description.es` y no `description.en`.
  await expect(page.getByText(/No requiere cuenta/)).toBeVisible();
  // Ocultar que gitlab exige Authorization es un defecto de contenido, y en
  // español ya faltó una vez. El nombre de la cabecera no se traduce; el rótulo
  // que dice que es obligatoria, sí.
  const gitlab = serverCard(page, "gitlab");
  await expect(gitlab).toContainText(ui.es.credentialsRequired);
  await expect(gitlab).toContainText("Authorization");
});

test("servers.json mantiene el índice para máquinas", async ({ request }) => {
  const res = await request.get("/servers.json");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { endpoints: Record<string, string> };
  expect(body.endpoints.libgen).toBe("https://mcp.jmrp.io/libgen");
  expect(body.endpoints.gitlab).toBe("https://mcp.jmrp.io/gitlab");
});
