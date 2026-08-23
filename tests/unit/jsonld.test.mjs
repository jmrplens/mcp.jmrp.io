/**
 * El grafo JSON-LD tiene que llegar al HTML desplegado.
 *
 * Estos tests miran `dist/`, no el código fuente, porque entre el frontmatter
 * de `Base.astro` y el fichero que sirve nginx hay dos pasos que pueden
 * comerse el bloque sin que nadie se entere: el bundling de Astro (si algún
 * día se pierde el `is:inline`, el script sale del HTML y acaba en un módulo
 * JS) y el minificador del post-build (`minifyJS: true`, que NO debe tocar un
 * bloque de datos `ld+json`). Un JSON-LD que no está, o que ha dejado de
 * parsear, es invisible: no rompe nada en pantalla y nadie lo ve fallar.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { PAGE_PATHS, pageUrl } from "../../src/lib/seo.ts";

// `dist` es un SYMLINK al color activo del blue/green, así que apunta a lo
// PUBLICADO, no a lo recién construido. `DIST_DIR` permite validar un build
// que aún no se ha desplegado (p. ej. `pnpm build:only && DIST_DIR=builds/green
// pnpm test:unit`), que es justo lo que hace falta para no publicar algo sin
// haberlo probado. Sin la variable, se comporta como siempre.
const DIST = new URL(
  `../../${process.env.DIST_DIR ?? "dist"}/`,
  import.meta.url,
);
const PERSON_ID = "https://jmrp.io/#person";

/**
 * Paths of the generated HTML pages that DECLARE an entity, relative to
 * `dist/`.
 *
 * `404.html` is excluded on purpose: it is an error body, not an address, so
 * it emits no graph. Emitting one was worse than not — everything derives from
 * `lang`, so the 404 redefined `https://mcp.jmrp.io/#webpage` with
 * `name: "Page not found"`, exactly the entity split the rest of the code
 * avoids. Pinned by `el 404 no declara identidad`.
 */
function htmlPages() {
  const pages = fs
    .readdirSync(DIST, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html") && f !== "404.html");
  assert.ok(pages.length > 1, "el sitio tiene al menos la raíz y /es/");
  return pages;
}

/** Contenido crudo de los bloques `application/ld+json` de una página. */
function jsonLdBlocks(page) {
  const html = fs.readFileSync(new URL(page, DIST), "utf8");
  return [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => m[1]);
}

/** Grafo ya parseado de una página, con mensaje útil si el JSON está roto. */
function graphOf(page) {
  const blocks = jsonLdBlocks(page);
  assert.equal(
    blocks.length,
    1,
    `${page}: se espera exactamente un bloque application/ld+json, hay ${blocks.length}`,
  );
  let parsed;
  try {
    parsed = JSON.parse(blocks[0]);
  } catch (error) {
    assert.fail(`${page}: el JSON-LD no es JSON válido — ${error.message}`);
  }
  assert.equal(parsed["@context"], "https://schema.org", `${page}: sin @context`);
  assert.ok(Array.isArray(parsed["@graph"]), `${page}: @graph no es una lista`);
  return parsed["@graph"];
}

test("TODAS las páginas llevan un bloque JSON-LD que parsea", () => {
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    assert.ok(graph.length > 0, `${page}: el @graph está vacío`);
  }
});

test("cada endpoint se une con el repositorio que lo produce", () => {
  // The code node ties an endpoint to its repo — the evidence behind "can I
  // trust this?". Its @id is #source-code, NEVER #software: that IRI is
  // defined by jmrp.io/projects with different data, and redefining it here
  // made the merged entity contradict itself (a regression that did ship).
  //
  // The hyphenated form is the one both documentation sites use for the same
  // repository, so the estate has ONE identifier per repo instead of two.
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    // La cuenta sale de `servers.json`, que nace de la misma fuente que el
    // grafo: si divergen, uno de los dos está mal.
    const index = JSON.parse(fs.readFileSync(new URL("servers.json", DIST), "utf8"));
    const sources = graph.filter((n) => n["@type"] === "SoftwareSourceCode");
    assert.equal(
      sources.length,
      Object.keys(index.endpoints).length,
      `${page}: falta un SoftwareSourceCode por servidor`,
    );
    const ids = new Set(graph.map((n) => n["@id"]));
    for (const source of sources) {
      assert.ok(
        String(source["@id"]).endsWith("#source-code"),
        `${page}: ${source["@id"]} pisa el @id canónico de jmrp.io/projects`,
      );
      // targetProduct es un array: el endpoint local (debe resolver en este
      // grafo) y el #software canónico de jmrp.io (referencia externa, que es
      // exactamente como debe funcionar linked data — apuntar sin redefinir).
      const raw = source.targetProduct ?? [];
      const targets = Array.isArray(raw) ? raw : [raw];
      assert.ok(
        targets.some((t) => ids.has(t["@id"])),
        `${page}: ${source["@id"]} no apunta a ningún endpoint del grafo`,
      );
    }
    // Y la vuelta: desde el endpoint se llega al código sin inversa de
    // targetProduct, vía isBasedOn.
    const apis = graph.filter((n) =>
      (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]).includes("WebAPI"),
    );
    for (const api of apis) {
      assert.ok(
        ids.has(api.isBasedOn?.["@id"]),
        `${page}: ${api["@id"]} no enlaza su código fuente (isBasedOn)`,
      );
      assert.ok(
        Array.isArray(api.featureList) && api.featureList.length > 0,
        `${page}: ${api["@id"]} sin featureList — un agente no sabe qué hace`,
      );
    }
  }
});

test("el grafo declara el sitio, la página y un WebAPI por servidor", () => {
  // `servers.json` sale de la MISMA fuente (`src/data/servers.ts`), así que
  // añadir un MCP y olvidarse del JSON-LD deja este test en rojo.
  const index = JSON.parse(
    fs.readFileSync(new URL("servers.json", DIST), "utf8"),
  );
  const endpoints = Object.values(index.endpoints);
  assert.ok(endpoints.length > 0, "servers.json sin endpoints");

  for (const page of htmlPages()) {
    const graph = graphOf(page);
    // `@type` puede ser un array: los nodos de endpoint son a la vez `WebAPI`
    // y `SoftwareApplication`, para heredar de CreativeWork propiedades como
    // `license` o `dateModified` que `WebAPI` no admite.
    const byType = (type) =>
      graph.filter((n) =>
        Array.isArray(n["@type"])
          ? n["@type"].includes(type)
          : n["@type"] === type,
      );

    assert.equal(byType("WebSite").length, 1, `${page}: falta el nodo WebSite`);
    assert.equal(byType("WebPage").length, 1, `${page}: falta el nodo WebPage`);

    const apis = byType("WebAPI");
    const byUrl = (a, b) => a.localeCompare(b);
    assert.deepEqual(
      apis.map((n) => n.url).sort(byUrl),
      [...endpoints].sort(byUrl),
      `${page}: los WebAPI no coinciden con los endpoints de servers.json`,
    );
    for (const api of apis) {
      assert.equal(
        api["@id"],
        `${api.url}#api`,
        `${page}: @id del WebAPI derivado del endpoint`,
      );
      assert.ok(api.documentation, `${page}: WebAPI ${api.url} sin documentation`);
    }
  }
});

test("el nodo #person es el canónico de jmrp.io y no trae su @context", () => {
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    const person = graph.find((n) => n["@id"] === PERSON_ID);
    assert.ok(person, `${page}: falta el nodo #person`);
    assert.equal(person["@type"], "Person", `${page}: #person con otro @type`);
    assert.ok(person.name, `${page}: #person sin nombre`);
    for (const node of graph) {
      assert.ok(
        !("@context" in node),
        `${page}: un nodo del @graph trae su propio @context`,
      );
    }
  }
});

test("los nodos propios enlazan a la persona por @id, sin redeclararla", () => {
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    const ids = new Set(graph.map((n) => n["@id"]));
    // `@type` is sometimes an array — the endpoints are
    // `["WebAPI", "SoftwareApplication"]` — so comparing it as a string
    // silently matched nothing and left the WebAPI nodes untested.
    const own = graph.filter((n) =>
      [n["@type"]]
        .flat()
        .some((t) => ["WebSite", "WebPage", "WebAPI"].includes(t)),
    );

    // Toda referencia `{"@id": …}` que sale de un nodo propio tiene que
    // resolver dentro del grafo: un @id mal escrito deja el nodo huérfano y no
    // hay validador que avise en el build.
    //
    // Exception: the two language versions point at each other with
    // `workTranslation` / `translationOfWork`, and the other node lives on the
    // other page. It is deliberately not redefined here — the same principle
    // by which `#software` nodes are referenced but live on jmrp.io/projects:
    // referencing without redefining is correct linked data, and redefining is
    // precisely what splits the entity.
    //
    // Built from PAGE_PATHS, not just the two home pages: every page pairs
    // with ITS OWN translation now, not the home page's, so `/internals/`
    // must be allowed to reference `/es/internals/#webpage` and vice versa.
    const crossLang = new Set(
      Object.values(PAGE_PATHS).flatMap((path) => [
        `https://mcp.jmrp.io/${path}#webpage`,
        `https://mcp.jmrp.io/es/${path}#webpage`,
      ]),
    );
    for (const node of own) {
      for (const ref of collectRefs(node)) {
        assert.ok(
          ids.has(ref) || crossLang.has(ref),
          `${page}: ${node["@id"]} referencia ${ref}, que no está en el grafo`,
        );
      }
    }

    const website = own.find((n) => n["@type"] === "WebSite");
    assert.equal(website.publisher["@id"], PERSON_ID);
    const apis = own.filter((n) => n["@type"] === "WebAPI");
    for (const api of apis) {
      assert.equal(api.provider["@id"], PERSON_ID);
      // Redeclarar los datos de la persona en cada nodo es justo lo que este
      // diseño evita: el documento de identidad es la única fuente de verdad.
      assert.deepEqual(Object.keys(api.provider), ["@id"]);
    }
  }
});

/** Todos los `{"@id": …}` que cuelgan de un nodo, a cualquier profundidad. */
function collectRefs(node) {
  const found = [];
  const walk = (value, isRoot) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, false);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (!isRoot && typeof value["@id"] === "string") found.push(value["@id"]);
    for (const [key, child] of Object.entries(value)) {
      if (key !== "@id") walk(child, false);
    }
  };
  walk(node, true);
  return found;
}

/**
 * Deduces `{ lang, page }` from a dist HTML path, using `PAGE_PATHS` as the
 * source of truth — the same map `pageUrl()` uses to build canonicals.
 *
 * @param {string} htmlPath Path relative to `dist/`, e.g. `"es/internals/index.html"`.
 * @returns {{ lang: "en" | "es", page: string }}
 */
function pageInfoFor(htmlPath) {
  const isEs = htmlPath.startsWith("es/");
  const lang = isEs ? "es" : "en";
  const rest = isEs ? htmlPath.slice("es/".length) : htmlPath;
  const page = Object.entries(PAGE_PATHS).find(
    ([, segment]) => `${segment}index.html` === rest,
  )?.[0];
  assert.ok(page, `${htmlPath}: no coincide con ningún PageId de PAGE_PATHS`);
  return { lang, page };
}

test("cada WebPage lleva SU url y SU @id, no los de la portada", () => {
  // Este es el defecto concreto de la auditoría del 2026-08-22:
  // buildSiteGraph() nunca recibía qué página se estaba pintando, así que
  // toda página que no fuera la portada emitía `url` y `@id` de "/" (o
  // "/es/") mientras su <head> ya publicaba la canónica correcta. El nombre
  // salía bien porque venía de `title`; la URL no, porque salía de
  // `pageUrl(lang)` a secas.
  for (const htmlPage of htmlPages()) {
    const { lang, page } = pageInfoFor(htmlPage);
    const graph = graphOf(htmlPage);
    const webpage = graph.find((n) => n["@type"] === "WebPage");
    const expectedUrl = pageUrl(lang, page);
    assert.equal(
      webpage.url,
      expectedUrl,
      `${htmlPage}: WebPage.url debería ser ${expectedUrl}`,
    );
    assert.equal(
      webpage["@id"],
      `${expectedUrl}#webpage`,
      `${htmlPage}: WebPage.@id debería colgar de SU url, no de la portada`,
    );
  }
});

test("el FAQPage cuelga SOLO de la portada", () => {
  // Los avisos son de las fichas, y las fichas están en la portada. Un
  // FAQPage en /policies/ describiría preguntas que esa página no contiene.
  const withFaq = [];
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    if (graph.some((n) => n["@type"] === "FAQPage")) withFaq.push(page);
  }
  assert.deepEqual(
    withFaq.sort((a, b) => a.localeCompare(b)),
    ["es/index.html", "index.html"],
    "el FAQPage tiene que estar en las dos portadas y en ninguna otra página",
  );
});

test("speakable cuelga SOLO del WebPage de la portada", () => {
  // Mismo razonamiento que el FAQPage: los `id` de DOM que señala
  // `speakable` los pone ServerCard, y ServerCard solo se pinta en la
  // portada.
  for (const htmlPage of htmlPages()) {
    const { page } = pageInfoFor(htmlPage);
    const graph = graphOf(htmlPage);
    const webpage = graph.find((n) => n["@type"] === "WebPage");
    if (page === "home") {
      assert.ok(webpage.speakable, `${htmlPage}: la portada sin speakable`);
    } else {
      assert.equal(
        webpage.speakable,
        undefined,
        `${htmlPage}: speakable fuera de la portada`,
      );
    }
  }
});

test("cada página se empareja con su traducción, no con la portada", () => {
  const graph = graphOf("internals/index.html");
  const webpage = graph.find((n) => n["@type"] === "WebPage");
  assert.equal(
    webpage.workTranslation["@id"],
    "https://mcp.jmrp.io/es/internals/#webpage",
  );
});

test("el 404 no declara identidad ni pide indexación", () => {
  const html = fs.readFileSync(new URL("404.html", DIST), "utf8");

  // No graph: emitting one would redefine the home page's @id under a
  // different name — two documents describing one entity with contradictory
  // data, the regression this repo already suffered with `#software`.
  assert.equal(
    html.includes("application/ld+json"),
    false,
    "el 404 emite JSON-LD: estaría redefiniendo la identidad de la portada",
  );

  // No canonical: it pointed at `/`, i.e. it declared itself to BE the home
  // page.
  assert.equal(
    /<link[^>]+rel="canonical"/.test(html),
    false,
    "el 404 declara canonical, y el suyo apuntaba a la portada",
  );

  // No hreflang and no Open Graph for the same reason: `og:url` is the
  // canonical, so a shared 404 link previewed as the home page.
  assert.equal(/hreflang=/.test(html), false, "el 404 emite hreflang");
  assert.equal(/property="og:url"/.test(html), false, "el 404 emite og:url");

  // And it must not ask to be indexed. The 404 status already prevents it,
  // but saying `index, follow` in an error body contradicts itself.
  assert.match(
    html,
    /<meta[^>]+content="noindex, follow"[^>]*>/,
    "el 404 no pide noindex",
  );
});
