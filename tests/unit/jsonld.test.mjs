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

import { serverCards } from "../../src/data/server-cards.ts";
import { servers } from "../../src/data/servers.ts";
import { PAGE_PATHS, pageUrl, serverPageUrl } from "../../src/lib/seo.ts";

// The build only creates a detail page for a server with a committed card
// (`servers.filter((server) => serverCards[server.id])` in `src/lib/llms.ts`
// — a server can be listed in `servers.ts` before its snapshot lands). Every
// loop below that reads a `servers/<id>/index.html` file has to walk THIS
// set, not `servers` itself, or a card-less server makes `graphOf()` fail on
// a missing file instead of reporting an actual graph problem.
const cardServers = servers.filter((server) => serverCards[server.id]);

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
 * Path (relative to `dist/`) of a server's WebAPI `@id`. Both the id and the
 * `@id` string it returns are derived straight from `servers.ts`, so they can
 * never drift from what `jsonld.ts`'s `apiId()`/`sourceId()` compute.
 */
function apiIdOf(server) {
  return `${server.endpoint}#api`;
}

function sourceIdOf(server) {
  return `${server.repo}#source-code`;
}

/**
 * Server DETAIL pages (`/servers/<id>/`, either language).
 *
 * These are the ONLY pages whose graph declares a full `WebAPI`/
 * `SoftwareApplication` + `SoftwareSourceCode` node — the entity lives where
 * it is described (see `jsonld.ts`'s header comment and `PageMeta.serverId`).
 * Every other page — including the `/servers/` INDEX itself — only
 * REFERENCES those nodes by `@id` (`mainEntity`, the FAQ's `about`), never
 * redeclares them. This regex is used below to assert that split, not to
 * exclude these pages: they carry a complete, correct graph like any other
 * page's now.
 */
const SERVER_DETAIL_PAGE = /^(es\/)?servers\/[^/]+\/index\.html$/;

function htmlPages() {
  const pages = fs
    .readdirSync(DIST, { recursive: true })
    .map(String)
    // `404.html` is excluded on purpose: it is an error body, not an
    // address, so it emits no graph. Emitting one was worse than not —
    // everything derives from `lang`, so the 404 redefined
    // `https://mcp.jmrp.io/#webpage` with `name: "Page not found"`, exactly
    // the entity split the rest of the code avoids. Pinned by
    // `el 404 no declara identidad`.
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

/** `n["@type"]` normalizado a array, para comparar sin importar si es un tipo o varios. */
function typesOf(node) {
  return [node["@type"]].flat();
}

test("TODAS las páginas llevan un bloque JSON-LD que parsea", () => {
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    assert.ok(graph.length > 0, `${page}: el @graph está vacío`);
  }
});

test("el WebAPI y su SoftwareSourceCode viven SOLO en la ficha de su servidor (en + es)", () => {
  // The whole point of this rewrite: before it, both nodes were redefined in
  // full on the home page AND on `/servers/`, and absent from the one page
  // that should carry them — the server's own detail page. Now exactly two
  // pages (en/es) define each pair, and every other page must not.
  for (const server of cardServers) {
    const apiId = apiIdOf(server);
    const sourceId = sourceIdOf(server);
    const apiPages = [];
    const sourcePages = [];
    for (const page of htmlPages()) {
      const graph = graphOf(page);
      if (graph.some((n) => n["@id"] === apiId && typesOf(n).includes("WebAPI"))) {
        apiPages.push(page);
      }
      if (graph.some((n) => n["@id"] === sourceId && n["@type"] === "SoftwareSourceCode")) {
        sourcePages.push(page);
      }
    }
    const byName = (a, b) => a.localeCompare(b);
    const expected = [
      `servers/${server.id}/index.html`,
      `es/servers/${server.id}/index.html`,
    ].sort(byName);
    assert.deepEqual(
      apiPages.sort(byName),
      expected,
      `${apiId}: debería declararse solo en su ficha (en+es), se declaró en ${JSON.stringify(apiPages)}`,
    );
    assert.deepEqual(
      sourcePages.sort(byName),
      expected,
      `${sourceId}: debería declararse solo en su ficha (en+es), se declaró en ${JSON.stringify(sourcePages)}`,
    );
  }
});

test("el WebAPI de un servidor declara los MISMOS datos en sus dos idiomas", () => {
  // The node's `@id` does not carry a language segment (it hangs off the
  // endpoint URL, which is the same for both `/servers/<id>/` and
  // `/es/servers/<id>/`), so the two pages describing it must agree on every
  // field — this is the data-drift risk "reference, don't redefine" exists
  // to close off.
  for (const server of cardServers) {
    const enApi = graphOf(`servers/${server.id}/index.html`).find(
      (n) => n["@id"] === apiIdOf(server),
    );
    const esApi = graphOf(`es/servers/${server.id}/index.html`).find(
      (n) => n["@id"] === apiIdOf(server),
    );
    assert.deepEqual(
      enApi,
      esApi,
      `${apiIdOf(server)}: los datos deberían ser idénticos entre /servers/${server.id}/ y /es/servers/${server.id}/`,
    );
  }
});

test("cada endpoint se une con el repositorio que lo produce, dentro de la ficha de su propio servidor", () => {
  // The code node ties an endpoint to the repository that produces it — the
  // evidence behind "can I trust this?". Its @id is #source-code, NEVER
  // #software: that IRI is defined by jmrp.io/projects with different data,
  // and redefining it here made the merged entity contradict itself (a
  // regression that did ship).
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    const sources = graph.filter((n) => n["@type"] === "SoftwareSourceCode");
    const apis = graph.filter((n) => typesOf(n).includes("WebAPI"));
    const ids = new Set(graph.map((n) => n["@id"]));

    if (SERVER_DETAIL_PAGE.test(page)) {
      assert.equal(sources.length, 1, `${page}: la ficha debería traer su propio SoftwareSourceCode`);
      assert.equal(apis.length, 1, `${page}: la ficha debería traer su propio WebAPI`);
    } else {
      assert.equal(sources.length, 0, `${page}: no debería redefinir ningún SoftwareSourceCode — solo la ficha del servidor lo hace`);
      assert.equal(apis.length, 0, `${page}: no debería redefinir ningún WebAPI — solo la ficha del servidor lo hace`);
    }

    for (const source of sources) {
      assert.ok(
        String(source["@id"]).endsWith("#source-code"),
        `${page}: ${source["@id"]} pisa el @id canónico de jmrp.io/projects`,
      );
      // targetProduct es un array: el endpoint LOCAL (debe resolver dentro de
      // esta misma página, porque WebAPI y SoftwareSourceCode viven juntos en
      // la ficha) y el #software canónico de jmrp.io (referencia externa, que
      // es exactamente como debe funcionar linked data — apuntar sin
      // redefinir).
      const raw = source.targetProduct ?? [];
      const targets = Array.isArray(raw) ? raw : [raw];
      assert.ok(
        targets.some((t) => ids.has(t["@id"])),
        `${page}: ${source["@id"]} no apunta a ningún endpoint de esta página`,
      );
    }
    // Y la vuelta: desde el endpoint se llega al código sin inversa de
    // targetProduct, vía isBasedOn.
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

test("el grafo declara el sitio y la página en cada URL, con un WebAPI SOLO en la ficha de su servidor", () => {
  // `servers.json` sale de la MISMA fuente (`src/data/servers.ts`), así que
  // añadir un MCP y olvidarse de darle ficha deja este test en rojo.
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
      graph.filter((n) => typesOf(n).includes(type));

    assert.equal(byType("WebSite").length, 1, `${page}: falta el nodo WebSite`);
    assert.equal(byType("WebPage").length, 1, `${page}: falta el nodo WebPage`);

    const apis = byType("WebAPI");
    if (SERVER_DETAIL_PAGE.test(page)) {
      assert.equal(apis.length, 1, `${page}: la ficha debería declarar exactamente un WebAPI`);
      assert.ok(
        endpoints.includes(apis[0].url),
        `${page}: el WebAPI (${apis[0].url}) no coincide con ningún endpoint de servers.json`,
      );
    } else {
      assert.equal(
        apis.length,
        0,
        `${page}: no debería declarar ningún WebAPI completo — solo referenciarlo por @id`,
      );
    }
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

test("los nodos propios enlazan a la persona por @id, sin redeclararla, y toda referencia resuelve en el sitio", () => {
  // Global id set: every @id declared by ANY page's graph. A reference is
  // valid linked data as soon as it resolves HERE, even when the node that
  // defines it lives on a DIFFERENT page than the one making the reference —
  // that is precisely the "reference, don't redefine" pattern this file
  // enforces for WebAPI now (jsonld.ts already used it for #software and for
  // workTranslation/translationOfWork). An orphaned @id — one nothing in the
  // whole site ever declares — is the one thing that must never happen.
  const pages = htmlPages();
  const graphs = new Map(pages.map((page) => [page, graphOf(page)]));
  const globalIds = new Set(
    [...graphs.values()].flatMap((graph) => graph.map((n) => n["@id"])),
  );

  for (const page of pages) {
    const graph = graphs.get(page);
    // `@type` is sometimes an array — the endpoints are
    // `["WebAPI", "SoftwareApplication"]` — so comparing it as a string
    // silently matched nothing and left the WebAPI nodes untested.
    const own = graph.filter((n) =>
      typesOf(n).some((t) => ["WebSite", "WebPage", "WebAPI", "FAQPage"].includes(t)),
    );

    for (const node of own) {
      for (const refId of collectRefs(node)) {
        assert.ok(
          globalIds.has(refId),
          `${page}: ${node["@id"]} referencia ${refId}, que no existe en ningún grafo del sitio`,
        );
      }
    }

    const website = own.find((n) => n["@type"] === "WebSite");
    assert.equal(website.publisher["@id"], PERSON_ID);
    const apis = own.filter((n) => typesOf(n).includes("WebAPI"));
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
 * Deduces `{ lang, page, serverId }` from a dist HTML path, using
 * `PAGE_PATHS` as the source of truth — the same map `pageUrl()` uses to
 * build canonicals. A server ficha (`servers/<id>/index.html`) does not
 * match any fixed `PAGE_PATHS` entry — `PAGE_PATHS.servers` is the INDEX's
 * own path — so it is detected separately and returns its `serverId`.
 *
 * @param {string} htmlPath Path relative to `dist/`, e.g. `"es/internals/index.html"`.
 * @returns {{ lang: "en" | "es", page: string, serverId?: string }}
 */
function pageInfoFor(htmlPath) {
  const isEs = htmlPath.startsWith("es/");
  const lang = isEs ? "es" : "en";
  const rest = isEs ? htmlPath.slice("es/".length) : htmlPath;
  const serverMatch = /^servers\/([^/]+)\/index\.html$/.exec(rest);
  if (serverMatch) {
    return { lang, page: "servers", serverId: serverMatch[1] };
  }
  const page = Object.entries(PAGE_PATHS).find(
    ([, segment]) => `${segment}index.html` === rest,
  )?.[0];
  assert.ok(page, `${htmlPath}: no coincide con ningún PageId de PAGE_PATHS`);
  return { lang, page, serverId: undefined };
}

test("cada WebPage lleva SU url y SU @id, no los de la portada ni los del índice de servidores", () => {
  // Este es el defecto concreto de la auditoría del 2026-08-22:
  // buildSiteGraph() nunca recibía qué página se estaba pintando, así que
  // toda página que no fuera la portada emitía `url` y `@id` de "/" (o
  // "/es/") mientras su <head> ya publicaba la canónica correcta. El nombre
  // salía bien porque venía de `title`; la URL no, porque salía de
  // `pageUrl(lang)` a secas. Una ficha de servidor tiene el mismo riesgo
  // frente al ÍNDICE `/servers/`, porque comparten `page: "servers"`.
  for (const htmlPage of htmlPages()) {
    const { lang, page, serverId } = pageInfoFor(htmlPage);
    const graph = graphOf(htmlPage);
    const webpage = graph.find((n) => n["@type"] === "WebPage");
    const expectedUrl = serverId ? serverPageUrl(lang, serverId) : pageUrl(lang, page);
    assert.equal(
      webpage.url,
      expectedUrl,
      `${htmlPage}: WebPage.url debería ser ${expectedUrl}`,
    );
    assert.equal(
      webpage["@id"],
      `${expectedUrl}#webpage`,
      `${htmlPage}: WebPage.@id debería colgar de SU url, no de la de la portada ni la del índice`,
    );
  }
});

test("el FAQPage cuelga SOLO de la portada", () => {
  // Los avisos son de las fichas, y las fichas están en la portada. Un
  // FAQPage en /policies/ o en una ficha de servidor describiría preguntas
  // que esa página no contiene.
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

test("cada ficha de servidor se empareja con SU traducción, no con la del índice", () => {
  for (const server of cardServers) {
    const graph = graphOf(`servers/${server.id}/index.html`);
    const webpage = graph.find((n) => n["@type"] === "WebPage");
    assert.equal(
      webpage.workTranslation["@id"],
      `https://mcp.jmrp.io/es/servers/${server.id}/#webpage`,
      `servers/${server.id}/: debería emparejarse con su propia ficha en es/, no con /es/servers/`,
    );
  }
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
