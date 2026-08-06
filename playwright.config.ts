import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:4321" },
  webServer: {
    // `astro preview` sirve `dist/`, así que los e2e prueban exactamente el
    // artefacto que se despliega, no el servidor de desarrollo. El `build`
    // previo es obligatorio: sin él `preview` serviría un `dist/` obsoleto y
    // los e2e podrían dar verde con el código fuente roto.
    command: "pnpm build && pnpm preview --port 4321",
    url: "http://localhost:4321",
    reuseExistingServer: false,
  },
});
