import { expect, test } from "@playwright/test";

import { inspector, loadButton, serverSelect } from "./helpers";

// Estos tests llaman al endpoint real de producción: es intencionado, validan
// el camino completo (navegador -> POST -> parseo SSE -> pintado). Si el
// entorno no tiene salida a Internet, exporta E2E_NO_NETWORK=1 para saltarlos.
// Salto CONDICIONAL por entorno, no un test aparcado: sin salida a Internet
// estos tests no pueden pasar.
// eslint-disable-next-line playwright/no-skipped-test
test.skip(
  !!process.env.E2E_NO_NETWORK,
  "requiere salida a Internet contra mcp.jmrp.io",
);

test("tools/list contra libgen devuelve las herramientas", async ({ page }) => {
  await page.goto("/");
  await serverSelect(page).selectOption("libgen");
  await loadButton(page).click();
  const out = page.getByTestId("inspector-output");
  await expect(out).toContainText("search", { timeout: 30_000 });
  await expect(out).toContainText("download");
});

test("initialize contra libgen devuelve el protocolo", async ({ page }) => {
  await page.goto("/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("libgen");
  await mcp.getByRole("button", { name: "initialize" }).click();
  await expect(page.getByTestId("inspector-output")).toContainText(
    "protocolVersion",
    { timeout: 30_000 },
  );
});

// Ejercita la isla, no su markup: el HTML del <select> y los <button> lo pinta
// el servidor, así que comprobar que se ven pasaría igual con la isla sin
// hidratar (sin `client:load`). Pulsar y esperar la respuesta sí verifica que
// /es/ monta el inspector de verdad.
test("el inspector también funciona en la página en español", async ({
  page,
}) => {
  await page.goto("/es/");
  await loadButton(page).click();
  await expect(page.getByTestId("inspector-output")).toContainText("search", {
    timeout: 30_000,
  });
});
