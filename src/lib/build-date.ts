import { execFileSync } from "node:child_process";

/**
 * Fecha de la última modificación REAL del contenido, para `dateModified`,
 * el `lastmod` del sitemap y la línea "Actualizado" del pie.
 *
 * Regla: árbol limpio → fecha del commit de HEAD; árbol sucio → hora actual,
 * porque lo que se está construyendo es más nuevo que cualquier commit.
 *
 * La regla existe por un fallo real que cazó una auditoría externa: el flujo
 * de despliegue construye ANTES de commitear, así que `git log -1` apuntaba
 * siempre al commit anterior y el sitio publicó un `dateModified` desfasado.
 *
 * Y no `new Date()` incondicional: con la hora del build, cada despliegue
 * anunciaría contenido nuevo aunque no cambiara una coma, y los buscadores
 * acaban ignorando el campo. Sin git (tarball, contenedor), `undefined`:
 * una fecha ausente es correcta; una inventada, no.
 */
// Ruta absoluta y no "git" a secas: resolver por PATH es un vector clásico y
// sonarjs lo veta. Si en algún entorno git vive en otro sitio, el catch
// devuelve undefined, que es el comportamiento previsto sin git.
const GIT = "/usr/bin/git";

export function contentDate(): string | undefined {
  const opts = {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  } satisfies Parameters<typeof execFileSync>[2];
  try {
    const dirty = execFileSync(GIT, ["status", "--porcelain"], opts).trim();
    if (dirty) return new Date().toISOString();
    return execFileSync(GIT, ["log", "-1", "--format=%cI"], opts).trim();
  } catch {
    return undefined;
  }
}

/**
 * Fecha de publicación del sitio, para `datePublished`: el primer commit.
 *
 * Es un hecho, no una elección: el repositorio nació con el sitio. La misma
 * regla que arriba para el caso sin git — `undefined` y el campo se omite,
 * porque una fecha ausente es correcta y una inventada no.
 */
export function publishedDate(): string | undefined {
  const opts = {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  } satisfies Parameters<typeof execFileSync>[2];
  try {
    const out = execFileSync(
      GIT,
      ["log", "--max-parents=0", "--format=%cI"],
      opts,
    ).trim();
    // Un repo puede tener varias raíces (merges de historias); la más antigua
    // es la última línea.
    return out.split("\n").at(-1) || undefined;
  } catch {
    return undefined;
  }
}
