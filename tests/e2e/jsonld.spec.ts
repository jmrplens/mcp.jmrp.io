import { expect, test } from "@playwright/test";

import { ui } from "../../src/i18n/ui";

/**
 * The structured data, seen from the browser.
 *
 * The unit tests already look at `dist/`; this checks what a unit test cannot:
 * that the block survives `astro preview` (that is, the file as really served,
 * with its header and its encoding) and that each language declares ITS OWN
 * page. A wrong `inLanguage` is exactly the kind of failure that is invisible
 * on screen.
 */

const PERSON_ID = "https://jmrp.io/#person";

type Node = Record<string, unknown> & {
  "@type"?: string | string[];
  "@id"?: string;
};

/** `@type` can be an array: the endpoints are WebAPI + SoftwareApplication. */
const hasType = (n: Node, t: string) =>
  Array.isArray(n["@type"]) ? n["@type"].includes(t) : n["@type"] === t;

/** Reads and parses the current page's single `application/ld+json` block. */
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

test("the root serves the English graph, linked to the person", async ({
  page,
}) => {
  await page.goto("/");
  const graph = await readGraph(page);

  const webpage = graph.find((n) => n["@type"] === "WebPage");
  expect(webpage?.["@id"]).toBe("https://mcp.jmrp.io/#webpage");
  expect(webpage?.inLanguage).toBe("en");
  expect(webpage?.description).toBe(ui.en.lede);

  // The person node travels whole: it is jmrp.io's canonical document, not a
  // copy trimmed by hand.
  const person = graph.find((n) => n["@id"] === PERSON_ID);
  expect(person?.["@type"]).toBe("Person");
  expect(person?.sameAs).toContain("https://github.com/jmrplens");

  // The home page NO LONGER defines the endpoints: each one is described on
  // its own detail page (`/servers/<id>/`), which is where the entity lives.
  // Here they are only REFERENCED by @id. Redefining them on both pages is
  // exactly what splits an entity into two copies that can contradict each
  // other.
  const apis = graph.filter((n) => hasType(n, "WebAPI"));
  expect(apis).toEqual([]);

  const serialized = JSON.stringify(graph);
  for (const id of [
    "https://mcp.jmrp.io/libgen#api",
    "https://mcp.jmrp.io/gitlab#api",
  ]) {
    expect(serialized).toContain(id);
  }
});

test("every server page defines ITS OWN endpoint, and only its own", async ({
  page,
}) => {
  for (const [id, url] of [
    ["libgen", "https://mcp.jmrp.io/libgen"],
    ["gitlab", "https://mcp.jmrp.io/gitlab"],
  ]) {
    // The endpoint is the SAME in both languages: the ES detail page
    // describes the same entity, so its WebAPI carries the same `url`. What
    // changes is the WebPage's `@id`, derived from `serverPageUrl(lang, id)`.
    for (const prefix of ["", "/es"]) {
      await page.goto(`${prefix}/servers/${id}/`);
      const graph = await readGraph(page);
      const apis = graph.filter((n) => hasType(n, "WebAPI"));
      expect(apis.map((n) => n.url)).toEqual([url]);
    }
  }
});

test("/es/ declares its own page without duplicating the English one's @id", async ({
  page,
}) => {
  await page.goto("/es/");
  const graph = await readGraph(page);

  const webpage = graph.find((n) => n["@type"] === "WebPage");
  expect(webpage?.["@id"]).toBe("https://mcp.jmrp.io/es/#webpage");
  expect(webpage?.inLanguage).toBe("es");
  expect(webpage?.description).toBe(ui.es.lede);

  // The WebSite, on the other hand, is the SAME node in both languages: its
  // text is tagged with @language instead of repeated on each page.
  const website = graph.find((n) => n["@type"] === "WebSite");
  expect(website?.["@id"]).toBe("https://mcp.jmrp.io/#website");
  expect(website?.description).toEqual([
    { "@value": ui.en.lede, "@language": "en" },
    { "@value": ui.es.lede, "@language": "es" },
  ]);
});
