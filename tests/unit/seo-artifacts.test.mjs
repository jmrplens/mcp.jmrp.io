/**
 * Los ficheros de SEO/GEO tienen que SALIR del build, y salir con contenido.
 *
 * Se miran sobre `dist/` y no sobre el código porque el fallo que importa no es
 * de sintaxis: es que un fichero deje de generarse. `robots.txt`, `llms.txt`,
 * las tarjetas sociales y el favicon no los ve nadie al abrir la página —no hay
 * pantalla que se ponga roja— así que su desaparición es invisible hasta que un
 * crawler deja de encontrarlos, y para entonces nadie relaciona una cosa con la
 * otra.
 *
 * El vhost sirve por LISTA BLANCA: un fichero nuevo aquí necesita además su
 * `location`. Por eso {@link SERVED_AT_ROOT} es una lista escrita a mano y no
 * un `readdirSync`: cuando alguien añada uno, este test se pondrá rojo y le
 * obligará a acordarse de nginx.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { serverCards } from "../../src/data/server-cards.ts";
import {
  DEFAULT_LANG,
  LANGS,
  PAGE_PATHS,
  pageUrl,
  serverPageUrl,
} from "../../src/lib/seo.ts";

// `dist` es un SYMLINK al color activo del blue/green, así que apunta a lo
// PUBLICADO, no a lo recién construido. `DIST_DIR` permite validar un build
// que aún no se ha desplegado (p. ej. `pnpm build:only && DIST_DIR=builds/green
// pnpm test:unit`), que es justo lo que hace falta para no publicar algo sin
// haberlo probado. Sin la variable, se comporta como siempre.
const DIST = new URL(
  `../../${process.env.DIST_DIR ?? "dist"}/`,
  import.meta.url,
);
const ORIGIN = "https://mcp.jmrp.io";

/** El vhost real, fuera del repo. Puede no existir si el build corre en otra máquina. */
const VHOST = "/etc/nginx/sites-available/mcp.jmrp.io.conf";

/**
 * Ficheros de la raíz de `dist/` que nginx sirve, cada uno con su `location`
 * en /etc/nginx/sites-enabled/mcp.jmrp.io.conf. Los snippets
 * `security_headers*_mcp.conf` NO están: se copian a /etc/nginx, no se sirven.
 */
const SERVED_AT_ROOT = [
  // Página de error con marca. No se sirve por su URL sino vía
  // `error_page 404 /404.html` en el vhost (con su `location = /404.html
  // internal;`) — y las error_page propias van ANTES del include compartido,
  // que trae las globales y en nginx gana la primera.
  "404.html",
  // Clave de IndexNow. No es un secreto: el protocolo exige publicarla para
  // demostrar control del dominio.
  "8b3b0f3c6a883bd7d274f2cf7645921a.txt",
  "apple-touch-icon.png",
  "favicon.svg",
  "humans.txt",
  "index.html",
  "llms-full.txt",
  "llms.txt",
  "og-en.png",
  "og-es.png",
  "robots.txt",
  "servers.json",
  "sitemap-0.xml",
  "sitemap-index.xml",
];

/** Snippets que el despliegue copia a /etc/nginx/snippets, no contenido web. */
const NGINX_SNIPPETS = new Set([
  "security_headers_mcp.conf",
  "security_headers_assets_mcp.conf",
]);

/** Orden estable para comparar listas de nombres de fichero. */
const byName = (a, b) => a.localeCompare(b);

/**
 * Lee un fichero de `dist/`, fallando con un mensaje que diga qué falta.
 *
 * @param name Ruta relativa a `dist/`.
 * @param encoding Codificación; `null` para bytes crudos.
 * @returns El contenido del fichero.
 */
function read(name, encoding = "utf8") {
  const url = new URL(name, DIST);
  assert.ok(fs.existsSync(url), `falta dist/${name} — el build no lo ha emitido`);
  return fs.readFileSync(url, encoding);
}

test("la raíz de dist/ es exactamente la lista blanca del vhost", () => {
  const found = fs
    .readdirSync(DIST, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    // nginx elige los precomprimidos junto al original; no son rutas propias.
    .filter((name) => !name.endsWith(".br") && !name.endsWith(".gz"))
    .filter((name) => !NGINX_SNIPPETS.has(name))
    .sort(byName);

  assert.deepEqual(
    found,
    [...SERVED_AT_ROOT].sort(byName),
    "un fichero de nivel raíz que sobra dará 404 hasta que se le añada su " +
      "`location` al vhost; uno que falta ha dejado de generarse",
  );
});

/**
 * Directorios de página que el vhost tiene que servir, cada uno con su
 * `location`. Escrito a mano y no derivado de `dist/`, por el mismo motivo que
 * SERVED_AT_ROOT: que añadir una página obligue a acordarse de nginx.
 */
const SERVED_PAGES = [
  "index.html",
  "es/index.html",
  "inspector/index.html",
  "es/inspector/index.html",
  "internals/index.html",
  "es/internals/index.html",
  "policies/index.html",
  "es/policies/index.html",
  "servers/index.html",
  "es/servers/index.html",
  "servers/libgen/index.html",
  "es/servers/libgen/index.html",
  "servers/gitlab/index.html",
  "es/servers/gitlab/index.html",
];

test("cada página generada tiene su location en el vhost", (t) => {
  // Hermano de SERVED_AT_ROOT: ese test solo mira la RAÍZ de dist/ (filtra por
  // entry.isFile()), así que las páginas nuevas, que viven en subdirectorios
  // (inspector/index.html), no las ve — una página sin `location` daría 404
  // en producción sin que nada se pusiera rojo.
  if (!fs.existsSync(VHOST)) {
    t.skip("el vhost no es legible en esta máquina");
    return;
  }
  const vhost = fs.readFileSync(VHOST, "utf8");
  for (const page of SERVED_PAGES) {
    read(page); // falla con un mensaje útil si el build no la emitió
    const url = "/" + page.replace(/index\.html$/, "");
    assert.ok(
      vhost.includes(`location = ${url} `) ||
        vhost.includes(`location = ${url}\n`),
      `${url} no tiene 'location' en el vhost: dará 404 en producción`,
    );
  }
});

test("robots.txt deja pasar a todo el mundo y anuncia el sitemap", () => {
  const robots = read("robots.txt");
  assert.match(robots, /^User-agent: \*$/m, "sin bloque comodín");
  assert.match(
    robots,
    new RegExp(String.raw`^Sitemap: ${ORIGIN}/sitemap-index\.xml$`, "m"),
    "sin la línea Sitemap el sitemap solo se descubre a mano",
  );
  assert.match(
    robots,
    /^Content-Signal: search=yes, ai-input=yes, ai-train=yes$/m,
    "la política de IA es explícita a propósito, igual que en jmrp.io",
  );
  assert.doesNotMatch(
    robots,
    /^Disallow: \/\s*$/m,
    "un `Disallow: /` aquí desindexaría el sitio entero",
  );
  for (const bot of ["Googlebot", "GPTBot", "ClaudeBot", "PerplexityBot"]) {
    assert.match(robots, new RegExp(`^User-agent: ${bot}$`, "m"), `sin ${bot}`);
  }
});

test("llms.txt y llms-full.txt describen los servidores de verdad", () => {
  const index = JSON.parse(read("servers.json"));
  const endpoints = Object.values(index.endpoints);
  assert.ok(endpoints.length > 0, "servers.json sin endpoints");

  const short = read("llms.txt");
  const full = read("llms-full.txt");

  // Salen de `src/data/servers.ts`, igual que servers.json: dar de alta un MCP
  // y olvidarse de estos ficheros deja el test en rojo.
  for (const endpoint of endpoints) {
    assert.ok(short.includes(endpoint), `llms.txt no menciona ${endpoint}`);
    assert.ok(full.includes(endpoint), `llms-full.txt no menciona ${endpoint}`);
  }
  assert.match(short, /^# mcp\.jmrp\.io$/m, "llms.txt sin el H1 del estándar");
  assert.ok(
    short.includes(`${ORIGIN}/llms-full.txt`),
    "el índice tiene que enlazar el documento largo",
  );
  assert.ok(
    full.includes("PRIVATE-TOKEN"),
    "la ficha larga tiene que decir qué cabecera pide gitlab",
  );
  assert.ok(full.length > short.length, "el documento largo no es más largo");
});

test("llms.txt lista las catorce páginas en los dos idiomas", () => {
  const short = read("llms.txt");
  for (const path of [
    "/",
    "/es/",
    "/inspector/",
    "/es/inspector/",
    "/internals/",
    "/es/internals/",
    "/policies/",
    "/es/policies/",
    "/servers/",
    "/es/servers/",
    "/servers/libgen/",
    "/es/servers/libgen/",
    "/servers/gitlab/",
    "/es/servers/gitlab/",
  ]) {
    // The Markdown link form `](<url>)`, not a bare substring: every URL in
    // this file is a prefix of some other entry (`/` of everything, `/servers/`
    // of `/servers/libgen/`…), so a bare `includes` passes even when that
    // entry's own line is missing. `buildLlmsTxt` always emits this exact
    // `](url)` shape (`src/lib/llms.ts`).
    assert.ok(
      short.includes(`](https://mcp.jmrp.io${path})`),
      `llms.txt no menciona ${path}`,
    );
  }
});

test("las tarjetas sociales son PNG de 1200x630", () => {
  for (const lang of ["en", "es"]) {
    const png = read(`og-${lang}.png`, null);
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      `og-${lang}.png no es un PNG`,
    );
    // IHDR: ancho y alto son los dos enteros de 32 bits tras la cabecera.
    assert.equal(png.readUInt32BE(16), 1200, `og-${lang}.png con otro ancho`);
    assert.equal(png.readUInt32BE(20), 630, `og-${lang}.png con otro alto`);
    // Una tarjeta de fondo liso pesa unos pocos KB: si el texto no se ha
    // pintado, esto lo caza aunque falle la comprobación del generador.
    assert.ok(png.length > 10_000, `og-${lang}.png sospechosamente vacía`);
  }
});

test("el favicon existe y es un SVG", () => {
  const svg = read("favicon.svg");
  assert.match(svg, /<svg[\s>]/, "favicon.svg no contiene un <svg>");
});

test("el sitemap lleva lastmod y las anotaciones hreflang", () => {
  const sitemap = read("sitemap-0.xml");
  for (const url of [`${ORIGIN}/`, `${ORIGIN}/es/`]) {
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), `el sitemap no lista ${url}`);
    assert.ok(
      sitemap.includes(`hreflang="en" href="${ORIGIN}/"`),
      "sin xhtml:link en, el clúster solo vive en el <head>",
    );
    assert.ok(
      sitemap.includes(`hreflang="es" href="${ORIGIN}/es/"`),
      "sin xhtml:link es, el clúster solo vive en el <head>",
    );
  }
  // Not a fixed literal: the site now has more than the two home pages
  // (`/inspector/` joined in this task, `/internals/` and `/policies/` are
  // coming), and each one gets its own <url> entry. The invariant that
  // matters is that NONE of them is missing a <lastmod>, not a specific count.
  const locs = [...sitemap.matchAll(/<loc>[^<]+<\/loc>/g)];
  const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];
  assert.equal(lastmods.length, locs.length, "cada URL necesita su lastmod");
  for (const [, value] of lastmods) {
    assert.ok(
      !Number.isNaN(Date.parse(value)),
      `lastmod ilegible: ${value}`,
    );
  }
});

test("cada entrada del sitemap declara SU x-default, no el de la portada", () => {
  const sitemap = read("sitemap-0.xml");
  // The serializer used to emit a hardcoded x-default pointing at the home
  // page for EVERY entry, contradicting the <head> each page emits. Nothing
  // pinned that value, so it was reintroducible without a single red test.
  // `servers/`, `servers/libgen/` and `servers/gitlab/` joined this sweep
  // with the `/servers/` section: each must self-reference, not fall back
  // to the section index's x-default, let alone the site root's.
  for (const path of [
    "",
    "inspector/",
    "internals/",
    "policies/",
    "servers/",
    "servers/libgen/",
    "servers/gitlab/",
  ]) {
    const self = `${ORIGIN}/${path}`;
    assert.ok(
      sitemap.includes(`hreflang="x-default" href="${self}"`),
      `el sitemap no declara x-default -> ${self}`,
    );
  }
});

/**
 * Content of every generated HTML page, indexed by route.
 *
 * Fixed pages are derived from `PAGE_PATHS` — the same map the site itself
 * builds URLs from — so a page added there is automatically covered here
 * too. Per-server detail pages (`/servers/<id>/`) are NOT one of
 * `PAGE_PATHS`'s fixed entries — see the comment on `PAGE_PATHS` in
 * `src/lib/seo.ts` for why a per-server route cannot be expressed there —
 * so they are appended separately, one per id in `serverCards` (the same
 * set `getStaticPaths` in `src/pages/servers/[server].astro` builds pages
 * for).
 *
 * Every entry carries its OWN expected canonical/hreflang URLs
 * pre-resolved (`url`, `enUrl`, `esUrl`, `xDefaultUrl`) rather than leaving
 * each downstream test to call `pageUrl(lang, page)` itself: that call is
 * only correct for `PAGE_PATHS`'s fixed entries — for a server detail page
 * it would silently resolve back to the `/servers/` INDEX URL instead of
 * that server's own page. `id` is `undefined` for fixed pages and the
 * server id for detail pages, so a test can tell the two apart without
 * comparing strings.
 *
 * @returns One entry per page/language combination the build emits — 14
 *   today: the 5 fixed pages (home/inspector/internals/policies/servers
 *   index) plus 2 server detail pages, each in both languages.
 */
function pages() {
  const found = [];
  for (const [page, dir] of Object.entries(PAGE_PATHS)) {
    for (const lang of LANGS) {
      const name = `${lang === "es" ? "es/" : ""}${dir}index.html`;
      found.push({
        name,
        html: read(name),
        lang,
        page,
        id: undefined,
        url: pageUrl(lang, page),
        enUrl: pageUrl("en", page),
        esUrl: pageUrl("es", page),
        xDefaultUrl: pageUrl(DEFAULT_LANG, page),
      });
    }
  }
  for (const id of Object.keys(serverCards)) {
    for (const lang of LANGS) {
      const name = `${lang === "es" ? "es/" : ""}servers/${id}/index.html`;
      found.push({
        name,
        html: read(name),
        lang,
        page: "servers",
        id,
        url: serverPageUrl(lang, id),
        enUrl: serverPageUrl("en", id),
        esUrl: serverPageUrl("es", id),
        xDefaultUrl: serverPageUrl(DEFAULT_LANG, id),
      });
    }
  }
  return found;
}

/** Todos los atributos de una etiqueta, como objeto. */
function attributesOf(raw) {
  return Object.fromEntries(
    [...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]),
  );
}

/**
 * Los `<link>` de una página, como mapas de atributos.
 *
 * Se leen atributo a atributo y no con un regex que fije su orden porque el
 * minificador del post-build los REORDENA (`rel="icon" href=…` sale como
 * `href=… rel="icon"`). Un test atado al orden se pondría rojo el día que
 * cambie la minificación, sin que nada haya dejado de funcionar.
 *
 * @param html HTML ya minificado de una página de `dist/`.
 * @returns Un objeto por cada `<link>`, con sus atributos.
 */
function linkTags(html) {
  return [...html.matchAll(/<link\b([^>]*)>/g)].map((m) => attributesOf(m[1]));
}

/**
 * Valor del atributo `content` de una `<meta>`, buscada por `property`/`name`.
 *
 * @param html HTML ya minificado de una página de `dist/`.
 * @param attribute `property` para Open Graph, `name` para Twitter.
 * @param key Nombre de la etiqueta, p. ej. `og:image`.
 * @returns El `content`, o `undefined` si esa etiqueta no está.
 */
function meta(html, attribute, key) {
  const tag = [...html.matchAll(/<meta\b([^>]*)>/g)]
    .map((m) => attributesOf(m[1]))
    .find((attributes) => attributes[attribute] === key);
  return tag?.content;
}

test("cada página emite Open Graph y Twitter Card completos", () => {
  for (const { name, html, lang, url } of pages()) {
    assert.equal(meta(html, "property", "og:type"), "website", name);
    assert.equal(meta(html, "property", "og:url"), url, `${name}: og:url`);
    assert.equal(
      meta(html, "property", "og:image"),
      `${ORIGIN}/og-${lang}.png`,
      `${name}: og:image tiene que ser ABSOLUTA o los clientes no la resuelven`,
    );
    assert.equal(meta(html, "property", "og:image:width"), "1200", name);
    assert.equal(meta(html, "property", "og:image:height"), "630", name);
    assert.ok(meta(html, "property", "og:image:alt"), `${name}: sin alt`);
    assert.equal(
      meta(html, "property", "og:locale"),
      lang === "en" ? "en_US" : "es_ES",
      `${name}: og:locale`,
    );
    for (const key of ["og:title", "og:description", "og:site_name"]) {
      assert.ok(meta(html, "property", key), `${name}: sin ${key}`);
    }

    assert.equal(
      meta(html, "name", "twitter:card"),
      "summary_large_image",
      `${name}: sin summary_large_image la tarjeta sale en miniatura`,
    );
    for (const key of ["twitter:title", "twitter:description", "twitter:image"]) {
      assert.ok(meta(html, "name", key), `${name}: sin ${key}`);
    }
  }
});

test("cada página se autorreferencia en hreflang", () => {
  for (const { name, html, lang, enUrl, esUrl, xDefaultUrl } of pages()) {
    const byLang = new Map(
      linkTags(html)
        .filter((link) => link.hreflang)
        .map((link) => [link.hreflang, link.href]),
    );

    // La autorreferencia es la que faltaba: sin ella Google descarta el clúster
    // ENTERO y las dos versiones compiten entre sí en vez de agruparse.
    assert.ok(
      byLang.has(lang),
      `${name}: no se autorreferencia (hreflang="${lang}")`,
    );
    assert.equal(byLang.get("en"), enUrl, `${name}: hreflang en`);
    assert.equal(byLang.get("es"), esUrl, `${name}: hreflang es`);
    // x-default points at THIS page's English version, not the home page's
    // nor (for a server detail page) the `/servers/` index's — same rule
    // the "cada entrada del sitemap declara SU x-default" test above checks
    // for the sitemap's own hreflang annotations.
    assert.equal(byLang.get("x-default"), xDefaultUrl, `${name}: x-default`);
    assert.equal(byLang.size, 3, `${name}: sobran o faltan anotaciones`);
  }
});

test("cada página declara favicon, canonical y el índice JSON", () => {
  for (const { name, html, url } of pages()) {
    const links = linkTags(html);
    const has = (predicate) => links.some((link) => predicate(link));

    assert.ok(
      has((l) => l.rel === "icon" && l.href === "/favicon.svg"),
      `${name}: sin favicon declarado no sale icono en los resultados`,
    );
    assert.ok(
      has((l) => l.rel === "canonical" && l.href === url),
      `${name}: canonical ausente o apuntando a otra URL`,
    );
    assert.ok(
      has((l) => l.type === "application/json" && l.href === "/servers.json"),
      `${name}: el índice para máquinas no se anuncia en el <head>`,
    );
  }
});

test("el <title> deja sitio a la expresión por la que se busca esto", () => {
  for (const { name, html, page, id } of pages()) {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    assert.ok(title, `${name}: sin <title>`);

    // Only the home page is written to rank for the broad "Model Context
    // Protocol" query — it is the only entry point someone searching that
    // exact phrase would land on. The inner pages target their own, narrower
    // intent instead (trying the servers, how routing works, the legal
    // position), and repeating the same phrase in every title would not help
    // any of them rank for anything. Compare `common.en.metaTitle` against
    // `inspector.en.inspectorMetaTitle` / `internals.en.metaTitle` /
    // `policies.en.policiesMetaTitle` in `src/i18n/ui/`: only the home page's
    // carries it, by design.
    if (page === "home") {
      assert.ok(
        title.includes("Model Context Protocol"),
        `${name}: el título no contiene la keyword — solo estaba en la description`,
      );
    }
    // A server detail page's title is `<server id> <fixed suffix>` (e.g.
    // "gitlab — MCP server card · mcp.jmrp.io", 38 chars in EN — see
    // `metaTitleServerSuffix` in `src/i18n/ui/servers-page.ts`). It is
    // legitimately short: the id is the whole differentiator, and it is
    // exactly as short as the MCP server's own name. Exempted from the
    // floor only, never from the ceiling.
    if (!id) {
      assert.ok(
        title.length >= 40,
        `${name}: ${title.length} caracteres, se queda corto (mínimo 40)`,
      );
    }
    assert.ok(
      title.length <= 65,
      `${name}: ${title.length} caracteres; Google recorta pasados ~60`,
    );
  }
});

test("el catálogo de descubrimiento y las server cards son coherentes", () => {
  // Discovery for a domain with SEVERAL MCP servers is two documents: the
  // catalog lists them and points at one card each, and every card describes
  // exactly one server. If they drift, a client following the catalog fetches
  // a card that does not exist.
  const catalog = JSON.parse(read("well-known/ai-catalog.json"));
  const index = JSON.parse(read("servers.json"));

  assert.equal(
    catalog.entries.length,
    index.servers.length,
    "el catálogo no lista los mismos servidores que servers.json",
  );

  for (const entry of catalog.entries) {
    assert.equal(
      entry.type,
      "application/mcp-server-card+json",
      `${entry.identifier}: type incorrecto`,
    );

    // La URL de la card tiene que existir de verdad en el build. El vhost la
    // sirve con un `location =`, que gana al `^~ /libgen` del proxy.
    const path = new URL(entry.url).pathname.replace(/^\//, "");
    const card = JSON.parse(read(path));

    assert.ok(card.name?.includes("/"), `${path}: name no es reverse-DNS`);
    assert.ok(card.version, `${path}: sin version`);
    assert.ok(card.description, `${path}: sin description`);

    // El endpoint de la card debe ser uno de los reales, no la URL de la card.
    const url = card.remotes?.[0]?.url;
    assert.ok(
      Object.values(index.endpoints).includes(url),
      `${path}: remotes[0].url (${url}) no es un endpoint de servers.json`,
    );

    // Una credencial declarada sin `isSecret` es una invitación a registrarla.
    for (const header of card.remotes[0].headers ?? []) {
      if (!header.isRequired) continue;
      const declared = index.servers.find((s) => s.endpoint === url);
      assert.ok(
        declared.requiredHeaders.includes(header.name),
        `${path}: cabecera ${header.name} no declarada en servers.json`,
      );
    }
  }
});

test("las páginas llevan los tokens que nginx sustituye por el estado en vivo", () => {
  // El estado (versión y nodos vivos de cada MCP) lo inyecta
  // /etc/nginx/lua/mcp_ssr_status.lua sustituyendo estos tokens al vuelo. Si
  // desaparecen del build, la sustitución no falla: simplemente no ocurre, y
  // la página sale sin estado sin que nada se ponga rojo. De ahí este test.
  //
  // En `astro preview` (los e2e) los tokens NO se sustituyen, porque los hooks
  // lua solo existen en el vhost de producción. Eso es lo esperado.
  //
  // Scoped to the home pages ON PURPOSE: the live-status badge is rendered by
  // ServerCard.astro, which only the home page includes, and nginx itself
  // only rewrites these tokens on `location = /` and `location = /es/` (see
  // the vhost). `/inspector/`, `/internals/` and `/policies/` never emit
  // these tokens and are not supposed to.
  const homePages = pages().filter((p) => p.page === "home");
  for (const { name, html } of homePages) {
    for (const token of ["MCPSSR_LIBGEN_STATUS", "MCPSSR_GITLAB_STATUS"]) {
      assert.ok(
        html.includes(token),
        `${name}: falta el token ${token} — nginx no tendrá qué sustituir`,
      );
    }
  }
});
