import { expect, test } from "@playwright/test";

import { ui } from "../../src/i18n/ui";

/**
 * Los datos estructurados, vistos desde el navegador.
 *
 * Los tests unitarios ya miran `dist/`; esto comprueba lo que el unitario no
 * puede: que el bloque sobrevive a `astro preview` (o sea, al fichero servido
 * de verdad, con su cabecera y su codificación) y que cada idioma declara SU
 * página. Un `inLanguage` equivocado es exactamente el tipo de fallo que no se
 * ve en pantalla.
 */

const PERSON_ID = "https://jmrp.io/#person";

type Node = Record<string, unknown> & { "@type"?: string; "@id"?: string };

/** Lee y parsea el único bloque `application/ld+json` de la página actual. */
async function readGraph(
  page: import("@playwright/test").Page,
): Promise<Node[]> {
  const blocks = page.locator('script[type="application/ld+json"]');
  await expect(blocks).toHaveCount(1);
  const raw = (await blocks.textContent()) ?? "";
  expect(raw.length).toBeGreaterThan(0);
  const parsed = JSON.parse(raw) as { "@context": string; "@graph": Node[] };
  expect(parsed["@context"]).toBe("https://schema.org");
  return parsed["@graph"];
}

test("la raíz sirve el grafo en inglés, enlazado a la persona", async ({
  page,
}) => {
  await page.goto("/");
  const graph = await readGraph(page);

  const webpage = graph.find((n) => n["@type"] === "WebPage");
  expect(webpage?.["@id"]).toBe("https://mcp.jmrp.io/#webpage");
  expect(webpage?.inLanguage).toBe("en");
  expect(webpage?.description).toBe(ui.en.lede);

  // El nodo de la persona viaja entero: es el documento canónico de jmrp.io,
  // no una copia recortada a mano.
  const person = graph.find((n) => n["@id"] === PERSON_ID);
  expect(person?.["@type"]).toBe("Person");
  expect(person?.sameAs).toContain("https://github.com/jmrplens");

  const apis = graph.filter((n) => n["@type"] === "WebAPI");
  expect(apis.map((n) => n.url)).toEqual([
    "https://mcp.jmrp.io/libgen",
    "https://mcp.jmrp.io/gitlab",
  ]);
});

test("/es/ declara su propia página sin duplicar el @id de la inglesa", async ({
  page,
}) => {
  await page.goto("/es/");
  const graph = await readGraph(page);

  const webpage = graph.find((n) => n["@type"] === "WebPage");
  expect(webpage?.["@id"]).toBe("https://mcp.jmrp.io/es/#webpage");
  expect(webpage?.inLanguage).toBe("es");
  expect(webpage?.description).toBe(ui.es.lede);

  // El WebSite y los WebAPI, en cambio, son el MISMO nodo en los dos idiomas:
  // su texto va etiquetado con @language en vez de repetido en cada página.
  const website = graph.find((n) => n["@type"] === "WebSite");
  expect(website?.["@id"]).toBe("https://mcp.jmrp.io/#website");
  expect(website?.description).toEqual([
    { "@value": ui.en.lede, "@language": "en" },
    { "@value": ui.es.lede, "@language": "es" },
  ]);
});
