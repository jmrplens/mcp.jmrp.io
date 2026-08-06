# AGENTS.md

Contexto para agentes de IA que trabajen en este repositorio.

## Qué es esto

El sitio público de **https://mcp.jmrp.io**: lista los servidores MCP
self-hosted y deja probarlos desde el navegador. Astro + UnoCSS con una isla
Preact, bilingüe (inglés en la raíz, español en `/es/`).

**Este repo NO es jmrp.io.** Sirve a otro dominio, con su propio despliegue y
su propia configuración de nginx.

La infraestructura de los servidores MCP (stack de Portainer, egreso por los
VPS, actualizaciones) está documentada aparte, en `/root/mcp_server_info.md`
del servidor.

## Restricciones que no se pueden violar

Las cinco rompen algo **en silencio**: nada falla, y te enteras tarde.

1. **Todo artefacto que este repo despliegue en `/etc/nginx/` lleva sufijo
   `_mcp`.** jmrp.io despliega los suyos al mismo directorio de snippets: un
   nombre repetido deja al otro sitio con la CSP equivocada.

2. **El HTML nunca se precomprime.** El nonce de la CSP lo inyecta nginx con
   `sub_filter`, que no puede reescribir un fichero comprimido. Los assets sí
   se precomprimen; el HTML no. Hay un test que lo vigila.

3. **`/libgen*` y `/gitlab*` nunca pasan por el Worker de Cloudflare.** Son
   proxy vivo con respuestas SSE y healthchecks: una caché de edge de 24 h los
   congelaría. Están dados de alta como rutas de zona sin worker.

4. **El token de GitLab del inspector nunca se persiste.** Ni `localStorage`,
   ni `sessionStorage`, ni query string, ni logs: vive en el estado del
   componente y desaparece al recargar. Hay tests e2e que lo comprueban.

5. **El vhost sirve por lista blanca.** Un fichero nuevo en `dist/` da **404**
   hasta que se le añade su `location`. `scripts/deploy-live-mcp.mjs` avisa de
   los que falten e imprime la línea exacta; el vhost lo edita un humano.

## Cosas que ya mordieron

- **Las fuentes necesitan el componente `<Font>` en el `<head>`, no solo
  `fonts:` en `astro.config`.** `tokens.css` define `--font-body` como
  `var(--font-ibm-plex-sans), …`; si esa variable no existe, la declaración
  entera es inválida y el navegador **ignora toda la cadena de fallback**. El
  sitio salió a producción en Times New Roman por esto.

- **`margin-inline: auto` sobre un hijo de flex column anula el `stretch`.**
  `body` es `display: flex; flex-direction: column`, así que las franjas se
  encogían al ancho de su contenido. Llevan `width: 100%`.

- **En una fila que pasa a `flex-direction: column`, el `flex-basis` deja de
  ser ancho y pasa a ser altura.** El inspector tenía cientos de píxeles de
  hueco muerto en móvil por eso.

- **Los campos de formulario llevan `font-size: 16px` absolutos, no `1rem`.**
  `base.css` aplica `html { font-size: 90% }` por debajo de 900 px, así que en
  móvil `1rem` son 14,4 px — y por debajo de 16 px iOS Safari hace auto-zoom al
  enfocar el campo.

- **Cloudflare cachea los 404.** Un fichero nuevo sigue dando 404 en el dominio
  aunque el origen ya lo sirva. El script de despliegue purga la caché.

- **`rewrite … break` corta la fase de rewrite**, y con ella los `if` que vengan
  después en la misma `location`. Por eso el `include` del snippet de proxy va
  **antes** del `rewrite` en el vhost.

## Estilo

Los estilos son una **copia** de jmrp.io: `src/styles/{tokens,base,global,
utilities}.css` y la configuración de UnoCSS. Si cambian allí, aquí hay que
resincronizarlos a mano — es el precio de tener los repos separados.

**No reutilices la navegación de jmrp.io**: enlaza a rutas raíz (`/about`,
`/blog`) que en este dominio serían 404. Los enlaces cross-site van en
**absoluto** (`https://jmrp.io/…`).

## Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `src/data/servers.ts` | **Única** fuente de verdad de la lista de MCP |
| `src/i18n/ui.ts` | Cadenas EN/ES. Las dos ramas deben tener las mismas claves |
| `src/components/Inspector.tsx` | La isla. No importes aquí nada con `node:fs` |
| `src/lib/mcp-client.ts` | POST + parseo de SSE. Sin DOM, testeable aparte |
| `src/lib/identity.ts` | Nodo `#person` canónico (ver abajo) |
| `src/lib/seo.ts` | URLs, hreflang y metadatos |
| `scripts/deploy-live-mcp.mjs` | Despliegue: snippets → nginx → purga de CF |
| `src/integrations/post-build/` | CSP, compresión y minificado |

## Identidad (`#person`)

El nodo `Person` canónico se descarga en build de
`raw.githubusercontent.com/jmrplens/jmrp.io/main/public/identity/person.jsonld`,
con `identity/person.snapshot.json` como respaldo.

Es **el mismo método que los otros sitios de documentación** (libgen-mcp,
gitlab-mcp-server, phonometry…). No lo cambies por leer el fichero del disco
local aunque compiles en la misma máquina que jmrp.io: el CI de GitHub Actions
no tiene esa ruta, y el mismo commit produciría un build con identidad en
producción y sin ella en CI.

Refrescar el snapshot: `pnpm run identity:sync`. El CI lo vigila con
`pnpm run identity:check`.

## Añadir un servidor MCP

1. Una entrada en `src/data/servers.ts`.
2. En el vhost, un `upstream` y un `location ^~` (lo hace un humano).
3. Una línea en el array `SERVICES` de `/root/scripts/mcp_update.sh`.

No hace falta tocar el markup ni el DNS. Y `connect-src 'self'` de la CSP
sigue valiendo: **todos los MCP cuelgan siempre de `mcp.jmrp.io`**.

## Comandos

```bash
pnpm dev                  # desarrollo
pnpm build                # build a dist/
pnpm deploy               # build + snippets a nginx + purga de Cloudflare
pnpm lint                 # eslint
pnpm typecheck            # astro check
pnpm test:unit            # node:test
pnpm test:e2e --workers=1 # playwright (llama a los endpoints reales)
pnpm identity:sync        # refresca el snapshot del #person
```

Las cuatro puertas deben quedar en verde antes de dar nada por terminado.
