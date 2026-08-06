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

const DIST = new URL("../../dist/", import.meta.url);
const ORIGIN = "https://mcp.jmrp.io";

/**
 * Ficheros de la raíz de `dist/` que nginx sirve, cada uno con su `location`
 * en /etc/nginx/sites-enabled/mcp.jmrp.io.conf. Los snippets
 * `security_headers*_mcp.conf` NO están: se copian a /etc/nginx, no se sirven.
 */
const SERVED_AT_ROOT = [
  // Clave de IndexNow. No es un secreto: el protocolo exige publicarla para
  // demostrar control del dominio.
  "8b3b0f3c6a883bd7d274f2cf7645921a.txt",
  "apple-touch-icon.png",
  "favicon.svg",
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
  const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];
  assert.equal(lastmods.length, 2, "cada URL necesita su lastmod");
  for (const [, value] of lastmods) {
    assert.ok(
      !Number.isNaN(Date.parse(value)),
      `lastmod ilegible: ${value}`,
    );
  }
});

/** Contenido de cada página HTML generada, indexado por ruta. */
function pages() {
  return ["index.html", "es/index.html"].map((name) => [name, read(name)]);
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
  for (const [name, html] of pages()) {
    const lang = name.startsWith("es/") ? "es" : "en";
    const url = lang === "en" ? `${ORIGIN}/` : `${ORIGIN}/es/`;

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
  for (const [name, html] of pages()) {
    const lang = name.startsWith("es/") ? "es" : "en";
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
    assert.equal(byLang.get("en"), `${ORIGIN}/`, `${name}: hreflang en`);
    assert.equal(byLang.get("es"), `${ORIGIN}/es/`, `${name}: hreflang es`);
    assert.equal(byLang.get("x-default"), `${ORIGIN}/`, `${name}: x-default`);
    assert.equal(byLang.size, 3, `${name}: sobran o faltan anotaciones`);
  }
});

test("cada página declara favicon, canonical y el índice JSON", () => {
  for (const [name, html] of pages()) {
    const lang = name.startsWith("es/") ? "es" : "en";
    const links = linkTags(html);
    const has = (predicate) => links.some((link) => predicate(link));

    assert.ok(
      has((l) => l.rel === "icon" && l.href === "/favicon.svg"),
      `${name}: sin favicon declarado no sale icono en los resultados`,
    );
    assert.ok(
      has(
        (l) =>
          l.rel === "canonical" &&
          l.href === `${ORIGIN}/${lang === "es" ? "es/" : ""}`,
      ),
      `${name}: canonical ausente o apuntando a otra URL`,
    );
    assert.ok(
      has((l) => l.type === "application/json" && l.href === "/servers.json"),
      `${name}: el índice para máquinas no se anuncia en el <head>`,
    );
  }
});

test("el <title> deja sitio a la expresión por la que se busca esto", () => {
  for (const [name, html] of pages()) {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    assert.ok(title, `${name}: sin <title>`);
    assert.ok(
      title.includes("Model Context Protocol"),
      `${name}: el título no contiene la keyword — solo estaba en la description`,
    );
    // Separadas: un `&&` en el assert no dice cuál de los dos límites se pasó.
    assert.ok(
      title.length >= 40,
      `${name}: ${title.length} caracteres, se queda corto (mínimo 40)`,
    );
    assert.ok(
      title.length <= 65,
      `${name}: ${title.length} caracteres; Google recorta pasados ~60`,
    );
  }
});
