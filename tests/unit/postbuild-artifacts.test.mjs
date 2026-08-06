import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const DIST = new URL("../../dist/", import.meta.url);

test("genera los artefactos con sufijo _mcp", () => {
  assert.ok(fs.existsSync(new URL("security_headers_mcp.conf", DIST)));
  assert.ok(fs.existsSync(new URL("security_headers_assets_mcp.conf", DIST)));
});

test("NO genera los nombres de jmrp.io", () => {
  assert.ok(
    !fs.existsSync(new URL("security_headers.conf", DIST)),
    "colisionaría con el snippet de jmrp.io",
  );
  assert.ok(!fs.existsSync(new URL("security_headers_assets.conf", DIST)));
});

test("el HTML no se precomprime", () => {
  const found = fs
    .readdirSync(DIST, { recursive: true })
    .filter((f) => String(f).endsWith(".html.br") || String(f).endsWith(".html.gz"));
  assert.equal(found.length, 0, "sub_filter no puede reescribir HTML comprimido");
});

test("los assets sí se precomprimen", () => {
  const found = fs
    .readdirSync(DIST, { recursive: true })
    .filter((f) => String(f).endsWith(".js.br") || String(f).endsWith(".css.br"));
  assert.ok(found.length > 0, "los assets estáticos deben llevar .br junto al original");
});

test("la CSP lleva la variable de nginx, no el literal del HTML", () => {
  const conf = fs.readFileSync(new URL("security_headers_mcp.conf", DIST), "utf8");
  assert.match(
    conf,
    /'nonce-\$cspNonce'/,
    "el add_header necesita la variable que nginx resuelve en cada petición",
  );
  assert.doesNotMatch(
    conf,
    /NGINX_CSP_NONCE/,
    "el literal del HTML en la cabecera dejaría el nonce fijo: la CSP no protegería nada",
  );
});

test("TODAS las páginas llevan el placeholder que sub_filter sustituye", () => {
  const pages = fs
    .readdirSync(DIST, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html"));
  assert.ok(pages.length > 1, "el sitio tiene al menos la página raíz y la de /es/");
  for (const page of pages) {
    const html = fs.readFileSync(new URL(page, DIST), "utf8");
    assert.match(
      html,
      /nonce="NGINX_CSP_NONCE"/,
      `${page} sin placeholder: la CSP con nonce le bloquearía scripts y estilos`,
    );
  }
});
