import { expect, test } from "@playwright/test";

import { ui } from "../../src/i18n/ui";
import { serverCard } from "./helpers";

test("lista los dos servidores MCP con su endpoint", async ({ page }) => {
  await page.goto("/");
  const libgen = serverCard(page, "libgen");
  const gitlab = serverCard(page, "gitlab");
  await expect(libgen).toBeVisible();
  await expect(gitlab).toBeVisible();
  await expect(libgen).toContainText("https://mcp.jmrp.io/libgen");
  await expect(gitlab).toContainText("https://mcp.jmrp.io/gitlab");

  // Ocultar que gitlab exige PRIVATE-TOKEN es un defecto de contenido. Da igual
  // con qué markup se cuente —antes una línea de texto, ahora una insignia más
  // una <dl>—: la ficha de gitlab tiene que decir que hay cabecera obligatoria
  // y cuál es.
  await expect(gitlab).toContainText(ui.en.credentialsRequired);
  await expect(gitlab).toContainText("PRIVATE-TOKEN");

  // Y la contraria: callar que libgen no pide nada deja al visitante buscando
  // unas credenciales que no existen.
  await expect(libgen).toContainText("No credentials required");
  await expect(libgen).not.toContainText("PRIVATE-TOKEN");
});

test("el enlace de vuelta a jmrp.io es absoluto", async ({ page }) => {
  await page.goto("/");
  const href = await page
    .getByRole("link", { name: /jmrp\.io/ })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^https:\/\/jmrp\.io/);
});
