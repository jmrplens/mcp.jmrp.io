import { expect, test } from "@playwright/test";

/**
 * Los ficheros de SEO/GEO se SIRVEN, no solo se generan.
 *
 * Los tests unitarios miran `dist/`; estos lo piden por HTTP al mismo artefacto
 * que se despliega. La diferencia importa: un fichero puede estar en el build y
 * no llegar a nadie —el vhost sirve por lista blanca y acaba en un 404
 * genérico— y ese desajuste no lo caza mirar el directorio.
 *
 * Lo que estos tests NO pueden comprobar es el vhost de producción: `astro
 * preview` sirve `dist/` entero. La lista blanca de nginx se comprueba en el
 * despliegue (scripts/deploy-live-mcp.mjs avisa de los ficheros sin `location`).
 */

/** Rutas que tienen que responder 200 con su tipo, además de las dos páginas. */
const RESOURCES = [
  { path: "/robots.txt", type: /text\/plain/ },
  { path: "/llms.txt", type: /text\/plain/ },
  { path: "/llms-full.txt", type: /text\/plain/ },
  { path: "/servers.json", type: /application\/json/ },
  { path: "/og-en.png", type: /image\/png/ },
  { path: "/og-es.png", type: /image\/png/ },
  { path: "/favicon.svg", type: /image\/svg\+xml/ },
  { path: "/sitemap-index.xml", type: /xml/ },
  { path: "/sitemap-0.xml", type: /xml/ },
];

for (const { path, type } of RESOURCES) {
  test(`${path} responde 200 con contenido`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status(), `${path} no se sirve`).toBe(200);
    expect(response.headers()["content-type"]).toMatch(type);
    expect((await response.body()).length).toBeGreaterThan(0);
  });
}

test("la imagen social que anuncia cada página existe de verdad", async ({
  page,
  request,
}) => {
  // Un `og:image` roto es peor que no tener ninguno: el cliente reserva el
  // hueco de la tarjeta y lo deja en blanco. Aquí se sigue el enlace tal cual
  // lo publica la página, en vez de dar por hecha la ruta.
  for (const path of ["/", "/es/"]) {
    await page.goto(path);
    const tag = page.locator('meta[property="og:image"]');

    // Absoluta y no relativa: ni Slack, ni WhatsApp, ni Bluesky resuelven una
    // ruta relativa, y se quedan sin imagen sin decir por qué.
    await expect(tag, `${path}: og:image ausente o relativa`).toHaveAttribute(
      "content",
      /^https:\/\/mcp\.jmrp\.io\//,
    );

    const image = (await tag.getAttribute("content")) ?? "";
    const response = await request.get(new URL(image).pathname);
    expect(response.status(), `${path}: og:image apunta a un 404`).toBe(200);
  }
});

test("robots.txt manda a los crawlers al sitemap que existe", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  const sitemap = /^Sitemap:\s*(\S+)$/m.exec(robots)?.[1];
  expect(sitemap, "robots.txt sin línea Sitemap").toBeTruthy();

  const index = await request.get(new URL(sitemap!).pathname);
  expect(index.status(), "el sitemap anunciado no se sirve").toBe(200);

  // Lo que anuncia robots.txt es el ÍNDICE; las URL están un salto más allá.
  // Se sigue la cadena entera porque un índice que apunte a un sitemap que no
  // se sirve deja al crawler con las manos vacías igual que no tener ninguno.
  const child = /<loc>([^<]+)<\/loc>/.exec(await index.text())?.[1];
  expect(child, "el índice no lista ningún sitemap").toBeTruthy();

  const urls = await request.get(new URL(child!).pathname);
  expect(urls.status(), "el sitemap del índice no se sirve").toBe(200);
  expect(await urls.text()).toContain("<loc>https://mcp.jmrp.io/</loc>");
});

test("cada servidor tiene un ancla propia a la que enlazar", async ({
  page,
}) => {
  await page.goto("/");
  const index = (await (await page.request.get("/servers.json")).json()) as {
    endpoints: Record<string, string>;
  };

  for (const id of Object.keys(index.endpoints)) {
    await expect(
      page.locator(`article#${id}`),
      `sin #${id} no se puede enlazar a ese servidor desde fuera`,
    ).toBeVisible();
  }
});
