# GEO Audit Report: mcp.jmrp.io

**Fecha:** 2026-08-06
**URL:** https://mcp.jmrp.io
**Tipo de sitio:** Documentación técnica / catálogo de API (servidores MCP)
**Páginas analizadas:** 2 (`/` en inglés, `/es/` en español) + 5 artefactos legibles por máquina

> Aviso de sesgo: este sitio lo construí yo en la sesión anterior. Todo lo que
> sigue está medido contra el sitio en vivo, los repos y el registro oficial de
> MCP; donde hay opinión, va marcada como tal.

---

## Resumen ejecutivo

**Puntuación GEO global: 57/100 (Poor–Fair)**

El sitio tiene **una capa técnica excelente y una capa de contenido delgada**. La
infraestructura está en el decil alto —TTFB de 50 ms, CSP con nonce por petición
sobre HTML cacheado en el edge, `robots.txt` que permite explícitamente 30+
crawlers de IA con `Content-Signal`, llms.txt conforme al estándar— pero la
página visible son 309 palabras que no nombran ni una sola herramienta, ni un
límite, ni al autor, ni una fecha.

Lo que más frena la visibilidad **no es el contenido: es que casi nadie enlaza al
sitio**, y que el propio ecosistema del autor publica un endpoint muerto.

### Desglose

| Categoría | Puntuación | Peso | Ponderado |
|---|---|---|---|
| AI Citability | 61/100 | 25% | 15,3 |
| Brand Authority | 15/100 | 20% | 3,0 |
| Content E-E-A-T | 53/100 | 20% | 10,6 |
| Technical GEO | 96/100 | 15% | 14,4 |
| Schema & Structured Data | 78/100 | 10% | 7,8 |
| Platform Optimization | 57/100 | 10% | 5,7 |
| **Global** | | | **56,8/100** |

Dos lecturas que el número solo no da:

- **El 15/100 de autoridad de marca arrastra la nota entera.** Esa rúbrica asigna
  30 puntos a Wikipedia y 20 a Reddit, inalcanzables para un subdominio de
  herramientas de desarrollo publicado ayer. El techo realista de este activo
  está en 55-60, y llegar ahí sube la global a ~65 sin tocar una línea del sitio.
- **De los 22 puntos que pierde el schema, 10 son marcado que sería un error
  añadir** (BreadcrumbList en un sitio plano, SearchAction sin buscador,
  `speakable` en 291 palabras). Ajustado a la forma real del sitio, el techo
  práctico del schema está en ~88.

---

## Críticos (arreglar ya)

### 1. El registro oficial de MCP publica un endpoint muerto para gitlab

`server.json` del repo `gitlab-mcp-server` declara:

```json
"remotes": [{ "url": "https://gitlab-mcp-server.fly.dev/" }]
```

**Ese host ya no resuelve** (NXDOMAIN — es el fly.io dado de baja). Y lo publicado
en el registro oficial es solo la plantilla:

| Servidor | El registro oficial publica |
|---|---|
| `libgen-mcp` v1.5.3 | `https://mcp.jmrp.io/libgen` ✅ |
| `gitlab-mcp-server` (todas) | `https://{host}:{port}/mcp` ❌ |

Consecuencia: **ningún cliente que descubra el servidor de GitLab por el registro
puede llegar al endpoint alojado**, y quien lea el repo va a un dominio inexistente.

**Arreglo:** cambiar la URL a `https://mcp.jmrp.io/gitlab`, subir versión y
republicar. `libgen-mcp` ya lo hace bien: copiar ese patrón.

### 2. Un sitio que pide credenciales sin canal de reporte

`/.well-known/security.txt`, `/privacy` y `/terms` devuelven **404** (verificado).
El sitio invita a pegar un Personal Access Token de GitLab y no ofrece a dónde
escribir si alguien encuentra un fallo. Es incoherente con el resto de su higiene
de seguridad.

### 3. Sin postura legal sobre Library Genesis

Se ofrece buscar y descargar de una biblioteca en disputa de copyright sin una
línea de descargo, jurisdicción ni límite de uso. Es una decisión del propietario,
pero conviene que sea deliberada y esté escrita.

---

## Alta prioridad

### 4. La asimetría del ecosistema propio

| Activo | Enlaza a mcp.jmrp.io |
|---|---|
| README de `libgen-mcp` | **4 menciones**, con badge "Hosted" ✅ |
| README de `gitlab-mcp-server` | **0** ❌ |
| `jmrp.io` (todo el sitio) | **0** ❌ |
| Fichas en Glama, PulseMCP, mcp.so, mcpservers.org | 0 — describen ambos como *"local-only"* |

El repo con más tracción (31 estrellas) no menciona el endpoint. Es el backlink de
mayor valor disponible y cuesta diez minutos.

### 5. La página no responde a la consulta de mayor intención

*"¿Cómo conecto un cliente MCP a un endpoint remoto?"* no tiene respuesta en el
HTML. Los hechos que la responden —JSON-RPC 2.0, stateless, `Accept:
application/json, text/event-stream`, GET→405— viven **solo en llms-full.txt**. Y
no hay ni un bloque de configuración copiable (`claude mcp add`,
`claude_desktop_config.json`, Cursor, VS Code).

### 6. Ninguna herramienta está nombrada

`gitlab-mcp-server` expone find/execute sobre 850+ acciones; `libgen` tiene cuatro
herramientas. **La página no nombra ni una.** Un LLM no puede responder "¿sirve
para crear un merge request?", que es justo la pregunta que traería tráfico.

### 7. Los pasajes citables no se auto-contienen

Ningún pasaje citable nombra el dominio. Un LLM que extraiga *"Search, download and
read books… No account required"* se queda con una frase que no dice qué es ni
dónde está.

### 8. Paridad EN/ES rota justo en la nota de seguridad

El español dice *"el servidor lo usa para esa petición y lo olvida"*. El inglés se
queda en *"which neither stores nor logs it"*. **La cláusula que mejor explica el
ciclo de vida del token falta en el idioma del `x-default`.**

### 9. La garantía más fuerte está desaprovechada

La CSP incluye `connect-src 'self'` y `form-action 'self'`: **el navegador impide
por sí mismo que el token salga hacia un tercero**, aunque el JavaScript quisiera.
Es una garantía aplicada por el navegador, no una promesa de buena fe — y la nota
no la menciona.

### 10. El grafo nunca conecta el endpoint con su código fuente

`Person.owns` apunta a 11 IRIs tipo `https://github.com/jmrplens/<repo>#software`
que **no están definidos en ninguna parte** — ni aquí ni en el grafo de jmrp.io.
El validador los materializa como `Thing` desnudos.

Consecuencia: el grafo afirma que existe un `WebAPI` en `mcp.jmrp.io/libgen#api` y
que el autor posee un software en `github.com/…#software`, y **jamás dice que sean
lo mismo**. Se pierden la licencia MIT, el lenguaje (Go) y, sobre todo, la conexión
entre *"31 estrellas en GitHub"* y *"este endpoint"* — justo la evidencia de
credibilidad que empuja a una IA a citar.

Definir dos nodos `SoftwareSourceCode` cierra la referencia colgante y une repo y
endpoint. Es el cambio de schema con más rendimiento.

### 11. El grafo no dice que sean gratis ni cómo se llaman

El `<h1>` dice "free to use" y `llms-full.txt` documenta `POST` + JSON-RPC 2.0 +
streamable HTTP. **Nada de eso está en el JSON-LD.** Son precisamente los hechos
que determinan si un asistente recomienda el endpoint. `offers`,
`isAccessibleForFree` y `potentialAction`/`EntryPoint` los codifican en ~15 líneas.

> El diagnóstico del análisis de schema, que resume bien el sitio entero: **el
> JSON-LD dice mucho menos que `llms-full.txt` sobre los mismos hechos.**

---

## Prioridad media

10. **Sin fechas.** Ni `datePublished`/`dateModified` en el JSON-LD ni fecha
    visible. Perplexity no puede afirmar que el sitio esté vigente, y los tres
    repos recibieron push hoy: el proyecto está vivo y el sitio no lo demuestra.
11. **Sin IndexNow.** Para un sitio recién publicado es la diferencia entre
    indexar en horas o en semanas. Con nginx delante es un `location` estático y
    un `curl` en el hook de despliegue.
12. **`/sitemap.xml` → 404.** Solo existe `/sitemap-index.xml`; algunos
    rastreadores prueban la ruta clásica. Un 301 lo resuelve.
13. **`/servers.json` son 207 bytes** con solo un mapa de endpoints, pese a estar
    enlazado desde robots.txt, llms.txt y un `<link rel="alternate">`. Podría
    llevar descripción, transporte, auth, cabeceras, repo y health por servidor.
14. **Documentación contradictoria sobre `GITLAB-URL`:** el sitio dice
    "opcional, por defecto gitlab.com"; el `server.json` del repo dice *"Required
    in the public hosted multi-tenant instance"*. Un LLM que lea ambas fuentes
    generará configuraciones rotas.
15. **Falta contenido en forma de pregunta y respuesta.** Es el formato que más
    se cita, y hoy no hay ninguno: los encabezados son etiquetas de entidad
    (`libgen`, `gitlab`).

    > **Contradicción entre dos análisis, resuelta:** el de citabilidad pedía
    > añadir schema `FAQPage`; el de schema dice que **no** se añada. Tienen
    > razón los dos y el orden importa: primero hay que **escribir** las
    > preguntas y respuestas reales; marcar `FAQPage` sobre contenido que no
    > existe sería marcado falso. Y aun escribiéndolas, Google restringe los
    > rich results de FAQ a gov/salud desde 2023, así que el valor está en el
    > contenido, no en la etiqueta.
16. **Sin byline visible.** El nombre del autor no aparece en ninguna parte de la
    página: se deduce del schema. Es autoridad regalada.
17. **Ergonomía móvil (WCAG 2.2 AA):** 12 de 18 elementos interactivos miden menos
    de 24 px de alto a 375 px de ancho. Y el cuerpo de texto queda en 14,4 px
    (ayuda: 12,24 px) por la regla `html { font-size: 90% }`, **heredada de
    jmrp.io** — cambiarla afecta a la coherencia entre los dos sitios.
18. **Sin límites ni disponibilidad declarados.** Ni rate limits, ni cuotas, ni
    uptime, ni el descargo honesto ("servicio personal, sin SLA") que permitiría a
    alguien decidir si depender de esto.

---

## Baja prioridad

19. Sin LICENSE en el repo `mcp.jmrp.io`, y sin `homepage` ni topics en GitHub.
20. Sin HTTP/3 (`alt-svc` ausente) — un toggle en Cloudflare.
21. Sin cabecera `Link: </servers.json>; rel="api-catalog"` — aplicable aquí por
    ser un sitio API-first.
22. Enlaza a `#readme` de los repos en vez de a sus sitios de documentación
    (`jmrplens.github.io/...`), que existen y responden 200.
23. UA `Anthropic-AI` obsoleto en robots.txt (inofensivo).

---

## Lo que está bien, y conviene no romper

- **Rendimiento**: TTFB ~50 ms, LCP 112 ms, CLS 0, 70 KB de página, `x-edge-sub-cache: HIT` en 8/8 medidas.
- **Sin dependencia de JavaScript**: el HTML crudo y el DOM renderizado tienen el mismo contenido (299 vs 294 palabras, diferencia de espaciado). La isla del inspector va con SSR.
- **Sin cloaking**: GPTBot, ClaudeBot, PerplexityBot y Googlebot reciben bytes idénticos a un `curl` anónimo.
- **robots.txt**: 100/100. `Content-Signal` con las tres claves correctas de la especificación.
- **llms.txt / llms-full.txt**: 95/100, conformes a llmstxt.org.
- **hreflang y canonical**: recíprocos, autorreferentes, con `x-default`, y duplicados en el sitemap vía `xhtml:link`.
- **Nota de seguridad**: *"desconfía por norma de cualquier web que te pida un token, incluida esta"*. Sus afirmaciones se verificaron contra el JS servido y **se cumplen**: 0 ocurrencias de `localStorage`/`sessionStorage`/`cookie`, token solo en cabecera.
- **Contenido humano**: sin banderas de generación por IA.

---

## Quick wins (esta semana)

1. **Corregir `server.json` de `gitlab-mcp-server`** → `https://mcp.jmrp.io/gitlab` y republicar en el registro. *Arregla un endpoint muerto publicado.*
2. **Añadir la sección "Hosted endpoint" al README de `gitlab-mcp-server`**, replicando la de `libgen-mcp`. *Backlink de máxima autoridad, 10 minutos.*
3. **Enlazar mcp.jmrp.io desde jmrp.io** (`/projects/`, `/es/projects/`, `/homelab/`). *Impacta a las cinco plataformas.*
4. **Publicar `/.well-known/security.txt`** con contacto. *Coherencia mínima para un sitio que pide credenciales.*
5. **Portar a la nota inglesa la cláusula que solo tiene la española**, y citar la CSP como garantía aplicada por el navegador.

## Plan a 30 días

### Semana 1 — Descubrimiento (lo que más rinde)
- [ ] `server.json` de gitlab → endpoint correcto + republicar
- [ ] README y docs de gitlab-mcp-server con la sección "Hosted"
- [ ] Enlaces desde jmrp.io (projects EN/ES, homelab)
- [ ] Reclamar las fichas de Glama, PulseMCP, mcp.so y mcpservers.org como *hosted*
- [ ] `homepage` y topics en el repo mcp.jmrp.io

### Semana 2 — Contenido citable
- [ ] Inventario de herramientas por servidor, con una línea de propósito cada una
- [ ] Bloques de configuración copiables por cliente (Claude Code, Desktop, Cursor, VS Code)
- [ ] Reescribir la entradilla para que se auto-contenga (nombrando el dominio)
- [ ] Bloque FAQ con preguntas como encabezados + schema `FAQPage`

### Semana 3 — Confianza y frescura
- [ ] `security.txt`, contacto, términos y postura legal sobre Library Genesis
- [ ] `datePublished`/`dateModified` + fecha visible + SHA desplegado
- [ ] Límites, cuotas y expectativa de disponibilidad declarados
- [ ] Byline visible con enlace a jmrp.io
- [ ] Paridad EN/ES de la nota + mención de la garantía de CSP

### Semana 4 — Alcance y pulido
- [ ] IndexNow con ping en el despliegue
- [ ] Anuncio en r/mcp y Show HN *(única vía realista a señal comunitaria)*
- [ ] Post en jmrp.io/blog sobre operar MCP públicos, enlazando al sitio
- [ ] Ergonomía móvil: 24 px de área táctil; decidir qué hacer con el 90% heredado
- [ ] `/sitemap.xml` → 301, HTTP/3, cabecera `Link: rel="api-catalog"`

---

## Apéndice: páginas analizadas

| URL | Título | Palabras | Hallazgos |
|---|---|---|---|
| `/` | MCP servers — free Model Context Protocol endpoints · jmrp.io | 309 | 12 |
| `/es/` | Servidores MCP — Model Context Protocol de uso libre · jmrp.io | 335 | 13 |
| `/robots.txt` | — | — | 1 (UA obsoleto) |
| `/llms.txt`, `/llms-full.txt` | — | — | 2 (falta inventario y datos operativos) |
| `/servers.json` | — | — | 1 (demasiado escueto) |
| `/sitemap-index.xml` | — | — | 1 (falta alias `/sitemap.xml`) |

**Método:** medidas contra el sitio en vivo (curl y Chromium headless), el registro
oficial de MCP, la API de GitHub y los directorios públicos. Cinco análisis
especializados en paralelo, contrastados a mano donde el hallazgo era grave.
