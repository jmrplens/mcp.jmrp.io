# edge-nonce-mcp

Worker de Cloudflare que da a `mcp.jmrp.io` **un nonce CSP por visitante sobre
HTML cacheado en el edge**. Copia del que sirve a jmrp.io, sin su lógica de RSS.

## El problema que resuelve

La CSP del sitio va por nonce, así que cada respuesta HTML es única y el origen
la sirve `no-store`: un sitio estático que renuncia a su CDN. Cachearla tal cual
haría que todos los visitantes compartieran nonce — justo lo que los nonces
existen para evitar.

El Worker rompe esa disyuntiva: cachea en el edge una copia **con el marcador
sin sustituir**, y acuña un nonce nuevo en cada petición.

## Por qué la CSP nunca se pierde

Son dos raíles independientes:

1. **Si el Worker cae**, el origen no ve la cabecera secreta y sustituye él
   mismo un nonce real: la CSP sigue siendo correcta y solo se pierde la caché
   del edge. El Worker además es *fail-open* — una excepción degrada a un fetch
   de paso, nunca al error 1101 de Cloudflare.

2. **Si nginx no reconoce el secreto** (rotado, typo, config revertida), el
   origen habría metido un nonce real en una copia destinada a cachearse, y un
   nonce real compartido por todo el mundo es la vulnerabilidad misma. Por eso
   el Worker **se niega a servir** cualquier respuesta cuya cabecera CSP no
   traiga el marcador: cae a fetch de paso sin cachear y lo señala en
   `X-Edge-Nonce`.

## Bypass — lo crítico

**`/libgen*` y `/gitlab*` no pueden pasar por el Worker.** Son proxy vivo con
respuestas SSE y healthchecks: una caché de 24 h los congelaría. El Worker deja
pasar de largo todo lo que no sea `GET`/`HEAD`, así que el tráfico MCP real
(POST) estaría a salvo igualmente — pero un `GET /libgen/health` sí se
cachearía.

Los bypass son **rutas de zona sin worker asignado**, no van en
`wrangler.toml`: Cloudflare aplica la ruta más específica, así que un bypass
estrecho gana a `mcp.jmrp.io/*`.

| Ruta | Por qué |
|---|---|
| `mcp.jmrp.io/libgen*` | Proxy MCP: SSE y healthchecks |
| `mcp.jmrp.io/gitlab*` | Proxy MCP: SSE y healthchecks |
| `mcp.jmrp.io/servers.json` | Índice para máquinas, sin nonce que sustituir |
| `mcp.jmrp.io/_astro/*` | Ya cachean bien; pasarlos quemaría cuota |

## Operativa

```bash
# Desplegar
npx wrangler@latest deploy

# Secreto (debe coincidir con el map del vhost)
npx wrangler@latest secret put EDGE_NONCE_KEY
```

El secreto de este sitio es **propio**, distinto del de jmrp.io: son dominios y
Workers separados. En el servidor está en `/root/.mcp_edge_nonce_key`, y en
nginx en el `map $http_x_edge_nonce_key $edge_placeholder_mode_mcp`.

**Rotación: primero nginx, después el secreto del Worker.** Entre los dos pasos
el raíl 2 cubre el hueco sirviendo sin caché.

## Comprobar que funciona

```bash
# La página SÍ pasa por el worker, y con nonce distinto cada vez
curl -sI https://mcp.jmrp.io/ | grep -i x-edge
for i in 1 2 3; do curl -s https://mcp.jmrp.io/ | grep -o 'nonce="[^"]*"' | head -1; done

# La caché del edge se calienta: MISS → HIT
curl -sI https://mcp.jmrp.io/ | grep -i x-edge-sub-cache

# Los endpoints MCP NO pasan por el worker (debe salir vacío)
curl -sI https://mcp.jmrp.io/libgen/health | grep -i x-edge-nonce
```

Si aparece `NGINX_CSP_NONCE` sin sustituir en el HTML, el secreto del Worker y
el del `map` de nginx no coinciden.
