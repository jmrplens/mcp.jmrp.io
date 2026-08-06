#!/usr/bin/env node
/**
 * Refresca el snapshot commiteado de la entidad `#person` canónica.
 *
 * El build descarga el documento vivo (ver src/lib/identity.ts); este snapshot
 * es solo el respaldo para cuando no hay red. Se refresca a propósito —con
 * este script y en su propio commit— para que la identidad que este sitio
 * publicaría sin red se vea en la revisión, en vez de quedarse congelada en lo
 * que fuera el día que se creó el fichero.
 *
 * Mismo script que en los otros sitios de documentación de los repos.
 *
 * Uso:
 *   node scripts/sync-identity.mjs           # escribe el snapshot
 *   node scripts/sync-identity.mjs --check   # falla si está obsoleto (CI)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const SOURCE =
  "https://raw.githubusercontent.com/jmrplens/jmrp.io/main/public/identity/person.jsonld";
const TARGET = path.join(process.cwd(), "identity", "person.snapshot.json");

const response = await fetch(SOURCE, { signal: AbortSignal.timeout(15_000) });
if (!response.ok) {
  console.error(`✗ No se pudo descargar ${SOURCE} — HTTP ${response.status}`);
  process.exit(1);
}
const latest = `${JSON.stringify(await response.json(), null, 2)}\n`;

if (process.argv.includes("--check")) {
  let committed;
  try {
    committed = readFileSync(TARGET, "utf8");
  } catch {
    console.error("✗ Falta identity/person.snapshot.json — créalo con: pnpm run identity:sync");
    process.exit(1);
  }
  if (committed !== latest) {
    console.error(
      "✗ identity/person.snapshot.json está obsoleto.\n" +
        "  Refréscalo con: pnpm run identity:sync",
    );
    process.exit(1);
  }
  console.log("✓ El snapshot coincide con el documento canónico.");
} else {
  mkdirSync(path.dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, latest);
  console.log("✓ identity/person.snapshot.json refrescado");
}
