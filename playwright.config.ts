import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:4321" },
  webServer: {
    // `astro preview` sirve el artefacto construido, así que los e2e prueban
    // exactamente lo que se despliega y no el servidor de desarrollo. El
    // `build` previo es obligatorio: sin él `preview` serviría un artefacto
    // obsoleto y los e2e podrían dar verde con el código fuente roto.
    //
    // OJO: aquí NO se puede llamar a `pnpm build`, porque desde el blue/green
    // (2026-08-22) ese script es el DESPLIEGUE completo — swap del symlink,
    // recarga de nginx, purga de Cloudflare, IndexNow y Bing. Con él, cada
    // ejecución de los e2e publicaba en producción; pasó de verdad, y encima
    // con el árbol sucio, así que el sitio quedó anunciando un `dateModified`
    // de reloj en lugar de la fecha del commit.
    //
    // Se construye en el color INACTIVO y se sirve ese mismo directorio: los
    // e2e ven el build nuevo y `dist` —lo que sirve nginx— no se toca.
    command:
      'DIST_DIR=$(node scripts/deploy-swap.mjs prepare) && astro build --outDir "$DIST_DIR" && astro preview --outDir "$DIST_DIR" --port 4321',
    url: "http://localhost:4321",
    reuseExistingServer: false,
  },
});
