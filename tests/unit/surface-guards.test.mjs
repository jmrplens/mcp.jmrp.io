/**
 * Guardias anti-fuga de la superficie extraída de los servidores MCP.
 *
 * La instancia GitLab del autor no puede aparecer en NADA publicado ni en
 * NADA commiteado: el repo es público y su hostname solo vive en `.env`
 * (MCP_SURFACE_FORBIDDEN_HOSTS). Por eso este fichero no contiene el valor por ningún lado
 * —ni en fixtures, ni en comentarios, ni en mensajes de fallo—: se lee de
 * `process.env` en el momento de ejecutar y, cuando algo falla, el assert
 * lista RUTAS de ficheros, nunca lo que se estaba buscando.
 *
 * Sin la variable (CI pública, sin `.env`) los escaneos se saltan con nota:
 * es el comportamiento deseado, porque la alternativa sería escribir el
 * hostname en el repo para poder buscarlo. En la máquina del autor `.env`
 * existe, así que aquí la guardia corre siempre.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// `dist` es un SYMLINK al color activo del blue/green, así que apunta a lo
// PUBLICADO, no a lo recién construido. `DIST_DIR` permite validar un build
// que aún no se ha desplegado (p. ej. `pnpm build:only && DIST_DIR=builds/green
// pnpm test:unit`), que es justo lo que hace falta para no publicar algo sin
// haberlo probado. Sin la variable, se comporta como siempre.
const DIST = fileURLToPath(
  new URL(`../../${process.env.DIST_DIR ?? "dist"}/`, import.meta.url),
);

// Los snapshots commiteados que alimentan el SSR también son superficie
// pública: una fuga aquí viaja directa al repo con el siguiente commit.
const SURFACE = fileURLToPath(
  new URL("../../src/data/surface/", import.meta.url),
);

// Mismo patrón que scripts/deploy-live-mcp.mjs: `loadEnvFile` NO pisa lo que
// ya venga del entorno (shell > .env) y un fichero ausente no es un error.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // Sin .env: vale lo que traiga el entorno.
}

/**
 * Agujas a buscar: los hosts de MCP_SURFACE_FORBIDDEN_HOSTS en minúsculas, con y sin puerto
 * (hoy el valor no lleva puerto, pero la guardia no debe depender de eso).
 * Devuelve `null` si la variable no está — el llamante decide saltarse.
 *
 * @returns {string[] | null} Subcadenas a detectar, o `null` sin variable.
 */
function resolveNeedles() {
  // MISMA variable que FORBIDDEN_HOSTS en scripts/sync-server-surface.mjs, y no
  // por gusto: si el build y su red de seguridad resuelven agujas distintas,
  // inspeccionan cosas distintas y una fuga puede publicarse con los dos en
  // verde. Cuando la guardia del build se desacopló del transporte (pasó de
  // derivar el host de la instancia a la que llamaba a leer su propia
  // variable), este resolutor se quedó atrás leyendo la vieja — exactamente el
  // fallo que avisaba el comentario de allí. Si cambia una, cambia la otra.
  const raw = process.env.MCP_SURFACE_FORBIDDEN_HOSTS;
  if (!raw) return null;
  const needles = new Set();
  for (const item of raw.split(",")) {
    const entry = item.trim();
    if (!entry) continue;
    let parsed = [];
    try {
      const u = new URL(entry.includes("://") ? entry : `https://${entry}`);
      parsed = [u.host, u.hostname];
    } catch {
      // Sin esquema y sin dos puntos: new URL lanza; cae al crudo, abajo.
    }
    if (parsed.filter(Boolean).length === 0) {
      // Valor sin esquema, O con dos puntos y sin esquema ("host:8443"): a este
      // último new URL NO le lanza — lo parsea como esquema + ruta opaca con
      // host VACÍO, y sin este respaldo los tests de escaneo se saltarían justo
      // con la variable puesta.
      parsed = [entry, entry.split(":", 1)[0]];
    }
    for (const h of parsed) {
      if (h) needles.add(h.toLowerCase());
    }
  }
  return needles.size > 0 ? [...needles] : null;
}

// Fuera del escaneo solo binarios (imágenes, fuentes) y los precomprimidos:
// .br/.gz son copia de un original que sí se escanea y su compresión podría
// ocultar la subcadena. Queda dentro el resto del build completo — HTML,
// JSON, TXT, XML, JS, CSS, SVG, .conf y los ficheros sin extensión como
// .well-known/api-catalog o los server-card.
const SKIP_EXTENSIONS = /\.(br|gz|png|ico|jpe?g|webp|woff2?)$/i;

/**
 * Escanea `rootDir` recursivamente y devuelve las rutas relativas de los
 * ficheros de texto que contienen alguna aguja (case-insensitive).
 *
 * @param {string} rootDir Directorio raíz a recorrer.
 * @param {string[]} needles Subcadenas ya en minúsculas.
 * @returns {string[]} Rutas relativas con alguna aguja dentro.
 */
function scanForNeedles(rootDir, needles) {
  const files = fs
    .readdirSync(rootDir, { recursive: true })
    .map(String)
    .filter((file) => !SKIP_EXTENSIONS.test(file))
    .filter((file) => fs.statSync(path.join(rootDir, file)).isFile());
  const leaks = [];
  for (const file of files) {
    const content = fs
      .readFileSync(path.join(rootDir, file), "utf8")
      .toLowerCase();
    if (needles.some((needle) => content.includes(needle))) {
      leaks.push(file);
    }
  }
  return leaks;
}

const SKIP_NOTE =
  "MCP_SURFACE_FORBIDDEN_HOSTS no está ni en el entorno ni en .env: no hay host que buscar " +
  "(en CI es lo esperado)";

test("ninguna superficie publicada contiene el host de la instancia GitLab", (t) => {
  const needles = resolveNeedles();
  if (!needles) {
    t.skip(SKIP_NOTE);
    return;
  }
  const leaks = scanForNeedles(DIST, needles);
  assert.deepEqual(
    leaks,
    [],
    `un host prohibido aparece en ${leaks.length} fichero(s) publicados: ` +
      `${leaks.join(", ")} — el valor buscado no se imprime a propósito`,
  );
});

test("los snapshots de src/data/surface/ tampoco contienen el host", (t) => {
  // El extractor ya trae su propio fallo duro antes de escribir; esto es la
  // red de seguridad por si alguien edita un snapshot a mano.
  const needles = resolveNeedles();
  if (!needles) {
    t.skip(SKIP_NOTE);
    return;
  }
  const leaks = scanForNeedles(SURFACE, needles);
  assert.deepEqual(
    leaks,
    [],
    `un host prohibido aparece en ${leaks.length} snapshot(s) commiteados: ` +
      `${leaks.join(", ")} — el valor buscado no se imprime a propósito`,
  );
});

test("la guardia muerde: un host plantado en una copia del dist se detecta", (t) => {
  // Verifica el MECANISMO, no el estado: si `scanForNeedles` dejara de ver la
  // subcadena, los dos tests anteriores quedarían en verde para siempre. El
  // árbol es SINTÉTICO — el mecanismo no necesita el dist real, y copiarlo
  // haría fallar este test en un checkout sin build (el header promete que
  // `pnpm test:unit` sin `.env` ni build queda verde). Sin GITLAB_URL se
  // planta una aguja sintética (TLD .invalid, RFC 2606) para que el mecanismo
  // quede probado también en CI.
  const needles = resolveNeedles() ?? ["gitlab.fixture.invalid"];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "surface-guard-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const copy = path.join(tmp, "dist");
  fs.mkdirSync(path.join(copy, "clean"), { recursive: true });
  fs.writeFileSync(
    path.join(copy, "clean", "index.html"),
    "<!doctype html><title>sin agujas</title>",
  );

  const planted = path.join("guard-fixture", "leak.json");
  fs.mkdirSync(path.join(copy, "guard-fixture"));
  fs.writeFileSync(
    path.join(copy, planted),
    // El host plantado sale del entorno (o de la aguja sintética), nunca de
    // un literal: este fichero temporal se borra en el `t.after` de arriba.
    JSON.stringify({ endpoint: `https://${needles[0]}/api/v4` }),
  );

  const leaks = scanForNeedles(copy, needles);
  assert.deepEqual(
    leaks,
    [planted],
    "el escaneo tenía que detectar exactamente el fichero plantado (y solo ese)",
  );
});
