import { expect, test } from "@playwright/test";

import { serverCards } from "../../src/data/server-cards";

/**
 * Los plegables de las fichas, y lo que las reemplazó.
 *
 * Las tools/prompts DEJARON de plegarse aquí: ese contenido se mudó a su
 * propia página, `/servers/<id>/` (ver `.superpowers/sdd/servers-section-spec.md`),
 * sin plegar — el objetivo explícito de la mudanza es más contenido citable,
 * no menos. Lo que queda plegado en esta página (config por cliente, avisos)
 * sigue existiendo porque el problema de scroll que motivó los plegables
 * seguía siendo real para ese contenido. Lo que NO puede pasar es que plegar
 * esconda contenido de los rastreadores: el `<details>` nativo lo mantiene en
 * el HTML, y eso es justo lo que se fija aquí.
 */

test("la ficha de un servidor enlaza a /servers/<id>/ con las cuentas reales, sin plegar nada", async ({
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

test("el contenido plegado sigue en el HTML servido", async ({ request }) => {
  const html = await (await request.get("/")).text();
  // Dos hechos que siguen dentro de plegables EN LA PORTADA (avisos legal y
  // de límites). Si algún día se cambian por carga diferida con JS, esto se
  // pone rojo — y con razón: dejarían de ser citables.
  expect(html).toContain("third-party public indexes");
  expect(html).toContain("no SLA");
});

test("las tools de una ficha no van plegadas: se leen sin abrir nada", async ({
  request,
}) => {
  // Lo contrario del test anterior, a propósito: `get_details` vivía dentro
  // de un <details> plegado en la portada; en su página propia es texto
  // corrido, ni siquiera necesita el truco "presente pero no visible" que
  // exigía un <details> cerrado.
  const html = await (await request.get("/servers/libgen/")).text();
  expect(html).toContain("get_details");
});

test("el resumen de un plegable que queda es alcanzable por teclado y tiene área táctil", async ({
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

test("el aviso del token llega CERRADO pero abre; la tranquilización nunca sin las cautelas", async ({
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
