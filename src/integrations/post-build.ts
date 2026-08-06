/**
 * Post-Build Integration (mcp.jmrp.io)
 *
 * Copia recortada de la integración homónima de jmrp.io. Corre en
 * `astro:build:done` y solo TRANSFORMA el contenido de `dist/`: extracción de
 * data URIs del CSS, pase de HTML (SRI, nonces, estilos inline a clases),
 * generación de los artefactos de cabeceras para nginx y compresión de assets.
 *
 * Dos invariantes de este sitio, ambas verificadas en
 * `tests/unit/postbuild-artifacts.test.mjs`:
 *
 * 1. Los `.conf` generados llevan sufijo `_mcp`. jmrp.io despliega sus propios
 *    snippets al mismo `/etc/nginx/snippets/`; un nombre repetido deja al otro
 *    sitio con la CSP equivocada.
 * 2. El HTML NO se precomprime. El nonce lo inyecta nginx con `sub_filter`,
 *    que no puede reescribir un fichero ya comprimido (ver `compression.ts`).
 *
 * El PUBLICADO (copiar los `.conf` a nginx, `nginx -t`, reload, purga de CDN)
 * no vive aquí: es `scripts/deploy-live-mcp.mjs`, que se ejecuta a mano.
 *
 * Respecto al original de jmrp.io se han quitado `optimizeImages` (el módulo
 * `images.ts` no se copia: este sitio no sirve imágenes propias) y el arreglo
 * de permisos con `sudo` (era para el layout blue/green de jmrp.io; aquí nginx
 * sirve `dist/` en su sitio y el despliegue es un script aparte).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

import { compressAssets } from "./post-build/compression.js";
import { finalizeCspConfig } from "./post-build/csp.js";
import { extractCssDataUris } from "./post-build/css.js";
import { processHtmlFiles } from "./post-build/html.js";
import type { CspData } from "./post-build/types.js";
import { timed } from "./timing.js";

/**
 * Crea la integración `mcp-post-build`.
 *
 * @returns {AstroIntegration} La integración configurada.
 */
export default function postBuildIntegration(): AstroIntegration {
  return {
    name: "mcp-post-build",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const relativeDist = path.relative(process.cwd(), distDir);
        logger.info(`Starting optimizations in [${relativeDist}]`);

        const cspData: CspData = {
          imageDomains: new Set<string>(),
        };

        try {
          await timed("extractCssDataUris", logger, () =>
            extractCssDataUris(distDir, logger),
          );

          // Los artefactos de CSP se generan siempre, se desplieguen o no:
          // así los tests pueden comprobarlos sin tocar nginx.
          const enableCsp = true;

          await timed("processHtmlFiles", logger, () =>
            processHtmlFiles(distDir, cspData, enableCsp, logger),
          );
          await timed("finalizeCspConfig", logger, () =>
            finalizeCspConfig(distDir, cspData, logger),
          );
          await timed("compressAssets", logger, () =>
            compressAssets(distDir, logger),
          );
        } catch (error) {
          logger.error("Fatal optimization error:");
          logger.error(
            error instanceof Error
              ? error.stack || error.message
              : String(error),
          );
          throw error instanceof Error ? error : new Error(String(error));
        }

        logger.info(`Optimizations completed successfully.`);
      },
    },
  };
}
