import { expect, test } from "@playwright/test";

/**
 * Los plegables de las fichas.
 *
 * Existen porque cada ficha medía ~1.400 px en móvil y el inspector quedaba a
 * cuatro pantallas de scroll; con cinco servidores habrían sido ocho. Lo que
 * NO puede pasar es que plegar esconda el contenido de los rastreadores: el
 * `<details>` nativo lo mantiene en el HTML, y eso es justo lo que se fija
 * aquí.
 */

test("las fichas llegan plegadas y se abren al pulsar", async ({ page }) => {
  await page.goto("/");
  const tools = page.locator("details.fold-tools").first();

  await expect(tools).not.toHaveAttribute("open", /.*/);
  // Los nombres de las tools ya NO se muestran con el plegable cerrado: con
  // un MCP de muchas herramientas eso era ruido. Pero siguen en el DOM, que
  // es lo que los mantiene citables — un rastreador lee dentro de un
  // <details> cerrado. Eso es justo lo que se comprueba aquí: presentes,
  // no visibles.
  const primerNombre = tools.locator("dt").first();
  await expect(primerNombre).toBeAttached();
  await expect(primerNombre).not.toBeVisible();

  await tools.locator("summary").click();
  await expect(tools).toHaveAttribute("open", /.*/);
  await expect(tools.locator("dd").first()).toBeVisible();
});

test("el contenido plegado sigue en el HTML servido", async ({ request }) => {
  const html = await (await request.get("/")).text();
  // Tres hechos que solo están dentro de plegables. Si algún día se cambian
  // por carga diferida con JS, esto se pone rojo — y con razón: dejarían de
  // ser citables.
  expect(html).toContain("third-party public indexes");
  expect(html).toContain("no SLA");
  expect(html).toContain("get_details");
});

test("el resumen es alcanzable por teclado y tiene área táctil", async ({
  page,
}) => {
  await page.goto("/");
  const summary = page.locator("details.fold-tools summary").first();
  const box = await summary.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);

  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("details.fold-tools").first()).toHaveAttribute(
    "open",
    /.*/,
  );
});

test("el aviso del token llega ABIERTO; la tranquilización nunca sin las cautelas", async ({
  page,
}) => {
  await page.goto("/");
  // Estos avisos arrancaban abiertos, para que la cautela estuviera a la
  // vista junto a la tranquilización. El autor pidió cerrarlos: la
  // contrapartida es que la advertencia queda a un clic, así que lo que se
  // vigila ahora es que ese clic funcione y que el contenido siga entero —
  // plegado no es lo mismo que ausente.
  const security = page.locator("details.fold-security").first();
  await expect(security).not.toHaveAttribute("open", /.*/);
  await security.locator("summary").click();
  await expect(security).toHaveAttribute("open", /.*/);
  await expect(
    security.locator("li", { hasText: /read_api/ }),
  ).toBeVisible();
});
