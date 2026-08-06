# mcp.jmrp.io

Sitio público de los servidores **Model Context Protocol** self-hosted de
[jmrp.io](https://jmrp.io): qué endpoints hay, cómo se usan, y un inspector
para probarlos desde el navegador.

**https://mcp.jmrp.io** · [Español](https://mcp.jmrp.io/es/)

## Los servidores

| Endpoint | Repositorio | Credenciales |
|---|---|---|
| `https://mcp.jmrp.io/libgen` | [libgen-mcp](https://github.com/jmrplens/libgen-mcp) | Ninguna |
| `https://mcp.jmrp.io/gitlab` | [gitlab-mcp-server](https://github.com/jmrplens/gitlab-mcp-server) | `PRIVATE-TOKEN` por petición |

Transporte **streamable HTTP**. `https://mcp.jmrp.io/servers.json` devuelve la
misma lista en JSON para clientes automáticos.

### Configurar un cliente MCP

```json
{
  "mcpServers": {
    "libgen": { "type": "http", "url": "https://mcp.jmrp.io/libgen" },
    "gitlab": {
      "type": "http",
      "url": "https://mcp.jmrp.io/gitlab",
      "headers": { "PRIVATE-TOKEN": "glpat-xxxxxxxxxxxx" }
    }
  }
}
```

`GITLAB-URL` es opcional: sin ella, el servidor usa `https://gitlab.com`.

> Los tokens viajan en cada petición y **no se guardan en el servidor**. El
> inspector de esta web los mantiene solo en la memoria del navegador: no toca
> `localStorage` ni cookies, y desaparecen al recargar.

> `GET` sobre un endpoint devuelve **405**: en modo *stateless* el protocolo
> reserva `GET`/`DELETE` para sesiones. No es que esté caído — usa `POST`, o
> `/libgen/health` para comprobar el estado.

## Desarrollo

Requiere Node 24 y pnpm.

```bash
pnpm install
pnpm dev
```

| Comando | Qué hace |
|---|---|
| `pnpm build` | Construye a `dist/` |
| `pnpm deploy` | Build + snippets a nginx + purga de Cloudflare |
| `pnpm lint` · `pnpm typecheck` | eslint · astro check |
| `pnpm test:unit` · `pnpm test:e2e` | node:test · Playwright |
| `pnpm identity:sync` | Refresca el snapshot de la identidad canónica |

Los e2e llaman a los **endpoints reales** en producción: es intencionado,
validan el camino completo. Sin salida a Internet, `E2E_NO_NETWORK=1` los salta.

## El inspector

Tres pestañas —**tools**, **prompts** y **resources**— con la misma mecánica:
cargar el catálogo, elegir una entrada y ejecutarla. Los argumentos se piden
con un formulario generado del esquema del servidor, con el tipo de cada campo,
cuáles son obligatorios y desplegables para los valores enumerados. Para
esquemas que ningún formulario representa bien, hay un modo JSON.

## Cómo está montado

Sitio estático de Astro con una isla Preact (el inspector). Se sirve desde
nginx en el mismo servidor que los MCP, que cuelgan del mismo dominio: por eso
el inspector habla con ellos en **mismo origen** y la CSP no necesita abrir
`connect-src`.

La CSP usa nonces por petición: el build deja un marcador y nginx lo sustituye,
con un Worker de Cloudflare que acuña uno nuevo en el edge sin romper la caché.

El nodo `Person` de los metadatos se descarga en build del
[documento canónico de jmrp.io](https://jmrp.io/identity/person.jsonld), igual
que en los demás sitios de documentación, con un snapshot commiteado de
respaldo.

## Añadir un servidor MCP

Una entrada en `src/data/servers.ts` y su `location` en el vhost. Nada de
markup: las fichas, el inspector, `servers.json` y `llms.txt` se generan de ahí.

Detalles y restricciones del proyecto, en [AGENTS.md](AGENTS.md).

## Licencia

MIT
