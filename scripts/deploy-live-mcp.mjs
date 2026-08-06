#!/usr/bin/env node
/**
 * Despliega a nginx los artefactos generados por el build.
 *
 * SUFIJO _mcp OBLIGATORIO: jmrp.io despliega sus propios snippets al mismo
 * directorio (/etc/nginx/snippets). Un nombre repetido deja al otro sitio con
 * la CSP equivocada, y el fallo es silencioso: nginx recarga tan contento.
 *
 * Si `nginx -t` falla tras copiar, se restaura el contenido anterior de cada
 * fichero y se sale con error SIN recargar: es preferible quedarse con la
 * configuración vieja que dejar nginx sin poder recargar.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const SNIPPETS = "/etc/nginx/snippets";
const FILES = ["security_headers_mcp.conf", "security_headers_assets_mcp.conf"];
const VHOST = "/etc/nginx/sites-enabled/mcp.jmrp.io.conf";

for (const f of FILES) {
  if (fs.existsSync(path.join(DIST, f))) continue;

  console.error(`✗ falta dist/${f} — ejecuta 'pnpm build' antes`);
  process.exit(1);
}

/**
 * Avisa de los ficheros de dist/ que nginx no sirve.
 *
 * El vhost sirve por LISTA BLANCA y acaba en `location / { return 404; }`, así
 * que un fichero nuevo en la raíz del build (robots.txt, llms.txt, og-*.png…)
 * da 404 en producción hasta que alguien le añade su `location`. Ese desajuste
 * era mudo: el build pasaba, el despliegue pasaba y solo un `curl` a mano lo
 * descubría.
 *
 * Es un AVISO y no un error a propósito. Este script no edita /etc/nginx —el
 * vhost se toca a mano, con revisión— así que fallar aquí dejaría el sitio sin
 * poder desplegarse por un fichero que quizá ni se quiere publicar. Lo que sí
 * hace falta es que nadie pueda decir que no lo sabía.
 */
function warnUnservedFiles() {
  let vhost;
  try {
    vhost = fs.readFileSync(VHOST, "utf8");
  } catch {
    console.warn(`⚠ no se pudo leer ${VHOST}: no se comprueban las rutas`);
    return;
  }

  // `location = /x` (exacta) y `location ^~ /x` o `location /x` (prefijo).
  const exact = new Set();
  const prefixes = [];
  for (const m of vhost.matchAll(/^\s*location\s+(=\s*|\^~\s*)?(\S+)\s*\{/gm)) {
    const [, modifier, uri] = m;
    if (!uri.startsWith("/")) continue; // regex (~) y nombradas (@): no aplican
    if (modifier?.startsWith("=")) exact.add(uri);
    else prefixes.push(uri);
  }

  const missing = fs
    .readdirSync(DIST, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    // Los snippets se COPIAN a /etc/nginx, no se sirven; los .br/.gz los elige
    // nginx solo junto al original; index.html lo sirve `location = /`.
    .filter(
      (name) =>
        !FILES.includes(name) &&
        !name.endsWith(".br") &&
        !name.endsWith(".gz") &&
        name !== "index.html",
    )
    .filter(
      (name) =>
        !exact.has(`/${name}`) &&
        prefixes.every((p) => p === "/" || !`/${name}`.startsWith(p)),
    );

  if (missing.length === 0) return;

  console.warn(
    `⚠ ${missing.length} fichero(s) del build sin 'location' en el vhost — darán 404:`,
  );
  for (const name of missing) {
    console.warn(`    location = /${name} { try_files /${name} =404; }`);
  }
}

warnUnservedFiles();

/** Contenido previo de cada destino, para poder revertir. */
const backups = new Map();

for (const f of FILES) {
  const dst = path.join(SNIPPETS, f);
  if (fs.existsSync(dst)) backups.set(dst, fs.readFileSync(dst));
  fs.copyFileSync(path.join(DIST, f), dst);
}

try {
  execFileSync("nginx", ["-t"], { stdio: "pipe" });
} catch (error) {
  for (const [dst, buf] of backups) fs.writeFileSync(dst, buf);
  for (const f of FILES) {
    const dst = path.join(SNIPPETS, f);
    if (!backups.has(dst)) fs.rmSync(dst, { force: true });
  }
  console.error("✗ 'nginx -t' falló; snippets restaurados, nginx NO recargado");
  console.error(String(error.stderr ?? error));
  process.exit(1);
}

execFileSync("systemctl", ["reload", "nginx"]);
console.log(`✓ ${FILES.join(", ")} desplegados y nginx recargado`);

// ── Purga de la caché de Cloudflare ────────────────────────────────────────
//
// Sin esto, un fichero nuevo se queda inaccesible aunque el origen lo sirva:
// Cloudflare cachea el 404 de antes de que existiera y lo sigue devolviendo.
// Pasó con robots.txt, llms.txt y las dos tarjetas OG — el origen respondía
// 200 y el dominio 404 con `age: 50`. Y el caso de las OG es el peor, porque
// la página ya anunciaba og:image: un enlace compartido reservaba la tarjeta
// y la dejaba en blanco.
//
// Credenciales por entorno, como en jmrp.io (PRIVATE_CF_*, definidas en
// /root/.bashrc). Si faltan, se avisa y NO se falla: el despliegue del origen
// ya ha ido bien y bloquearlo por la CDN sería peor.
const { PRIVATE_CF_API_TOKEN: cfToken, PRIVATE_CF_EMAIL: cfEmail } = process.env;
const cfZone = process.env.PRIVATE_CF_ZONE_ID ?? "44d43a33307a232a60a5af4fc1504613";

if (cfToken) {
  // Con email = Global API Key (cabeceras legacy); sin él = API Token.
  const headers = cfEmail
    ? { "X-Auth-Email": cfEmail, "X-Auth-Key": cfToken, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" };

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZone}/purge_cache`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ purge_everything: true }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const body = await response.json();
    console.log(
      body.success
        ? "✓ caché de Cloudflare purgada"
        : `⚠ la purga de Cloudflare falló: ${JSON.stringify(body.errors)}`,
    );
  } catch (error) {
    console.warn(`⚠ no se pudo purgar la caché de Cloudflare: ${error.message}`);
  }
} else {
  console.warn(
    "⚠ sin PRIVATE_CF_API_TOKEN: no se purga la caché de Cloudflare.\n" +
      "  Si has añadido ficheros nuevos, seguirán dando 404 en el dominio hasta que expire.",
  );
}
