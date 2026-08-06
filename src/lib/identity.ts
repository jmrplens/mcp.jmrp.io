/**
 * Nodo `#person` canónico de jmrp.io, resuelto en tiempo de BUILD.
 *
 * MISMO MÉTODO que los otros sitios de documentación (libgen-mcp,
 * gitlab-mcp-server, phonometry…): se descarga de GitHub y hay un snapshot
 * commiteado como respaldo. Un único método para los seis sitios, y un build
 * que se reproduce en cualquier máquina.
 *
 * Antes esto leía `/var/www/jmrp.io/public/identity/person.jsonld` del disco,
 * aprovechando que compilamos en la misma máquina. Se descartó: el CI de
 * GitHub Actions NO tiene esa ruta, así que el mismo commit habría producido
 * un build con identidad en producción y sin ella en CI. Dos caminos según
 * dónde compiles es exactamente cómo uno de los dos se pudre sin que nadie se
 * entere.
 *
 * Se descarga de `raw.githubusercontent.com` y no de `https://jmrp.io` por el
 * mismo motivo que el resto de sitios: jmrp.io está detrás de Cloudflare,
 * CrowdSec y el bouncer de MikroTik, donde una IP de runner bloqueada
 * degradaría el sitio a un snapshot obsoleto en silencio. GitHub sirve los
 * mismos bytes y ya es dependencia dura del build.
 *
 * NO se usa `import … from "….jsonld"`: Vite no conoce esa extensión y
 * rolldown parsea el fichero como JavaScript (PARSE_ERROR, verificado).
 *
 * ESTE MÓDULO NO DEBE IMPORTARSE NUNCA DESDE UNA ISLA (`Inspector.tsx`):
 * `node:fs` en el bundle de cliente rompe el build — que es, de hecho, la red
 * de seguridad que garantiza que nadie lo haga por accidente.
 */
import fs from "node:fs";
import path from "node:path";

/** Documento canónico que genera `jmrp.io/scripts/ci/build-identity.mjs`. */
export const IDENTITY_URL =
  process.env.IDENTITY_URL ??
  "https://raw.githubusercontent.com/jmrplens/jmrp.io/main/public/identity/person.jsonld";

/** Respaldo commiteado. Se refresca con `pnpm run identity:sync`. */
export const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "identity",
  "person.snapshot.json",
);

/** `@id` que el documento DEBE declarar; si cambia, el contrato se rompió. */
export const PERSON_ID = "https://jmrp.io/#person";

/** Nodo Person listo para empalmar en un `@graph` (ya sin `@context` propio). */
export type PersonNode = Record<string, unknown>;

/**
 * Comprueba el contrato y quita el `@context` propio.
 *
 * El `@context` sobra porque el nodo entra en un `@graph` que ya lo declara, y
 * un `@context` anidado en un nodo del grafo no es JSON-LD válido.
 *
 * @param parsed Documento ya parseado.
 * @param origen De dónde salió, para el mensaje de error.
 * @returns El nodo normalizado.
 */
function normalize(parsed: unknown, origen: string): PersonNode {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`[identity] ${origen}: no es un objeto JSON-LD`);
  }
  const node = parsed as Record<string, unknown>;
  if (node["@type"] !== "Person" || node["@id"] !== PERSON_ID) {
    throw new Error(
      `[identity] ${origen}: contrato roto — @type=${String(node["@type"])} @id=${String(node["@id"])}`,
    );
  }
  // Filtrado en vez de rest destructuring: `no-unused-vars` no tiene
  // `varsIgnorePattern` configurado en este repo.
  return Object.fromEntries(
    Object.entries(node).filter(([key]) => key !== "@context"),
  );
}

/**
 * Descarga el documento canónico; si falla, cae al snapshot commiteado.
 *
 * El aviso del respaldo es deliberadamente ruidoso: una identidad obsoleta no
 * debe publicarse sin que nadie lo vea. Que el snapshot esté al día lo vigila
 * `scripts/sync-identity.mjs --check` en el CI.
 *
 * @returns El nodo Person listo para el grafo.
 */
export async function loadPersonNode(): Promise<PersonNode> {
  try {
    const response = await fetch(IDENTITY_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalize(await response.json(), IDENTITY_URL);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `\n⚠ [identity] No se pudo descargar la entidad Person canónica (${reason}).\n` +
        `  Se usa el snapshot commiteado — este build puede publicar una identidad obsoleta.\n` +
        `  Refrescar con: pnpm run identity:sync\n`,
    );
    return normalize(
      JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as unknown,
      SNAPSHOT_PATH,
    );
  }
}
