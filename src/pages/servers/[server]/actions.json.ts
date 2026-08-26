/**
 * Índice compacto del catálogo de acciones dinámicas de un servidor, en
 * `/servers/<id>/actions.json` — la ruta que `/servers.json` y los
 * `llms*.txt` anuncian como `index`, y la que consume la isla del buscador.
 *
 * Existe porque el manifiesto real (`gitlab://tools`, ~516 KB) solo se puede
 * leer con token por JSON-RPC, y ningún rastreador va a hacer esa llamada:
 * este fichero es la vista estática y sin credenciales del mismo catálogo,
 * refrescada en cada build por `scripts/sync-server-surface.mjs` con
 * snapshot committeado de respaldo (`src/data/surface/`).
 *
 * Qué se emite y qué no: cada entrada lleva `id`, `domain`, `title`,
 * `destructive` y `read_only` — la proyección whitelisted que el extractor
 * materializa en el snapshot. `kind`, `tool`, `backing_tool`,
 * `backing_action` y `detail_uri` se descartan aguas arriba (`detail_uri`
 * es derivable: la plantilla `meta.uriTemplate` del snapshot con el `id` de
 * la entrada, hoy `gitlab://tools/{id}`). Sin pretty-print: con cientos de
 * entradas el tamaño importa, y el post-build ya genera los `.br`/`.gz`.
 *
 * `entry_count` es el número de entradas EMITIDAS (el `actionCount` del
 * snapshot; el `entryCount` upstream incluye además la entrada de
 * herramienta visible que la proyección excluye): el invariante comprobable
 * es `entries.length === entry_count`. La nota "Free-tier" va pegada al
 * recuento porque el manifiesto se lee con `cacheScope: "private"` — es la
 * superficie de ESE token, no la universal.
 */
import type { APIRoute, GetStaticPaths } from "astro";

import type { GitlabActionsSnapshot } from "../../../data/surface";
import { actionCatalogs } from "../../../data/surface";

/**
 * Una ruta por servidor CON catálogo committeado (hoy: gitlab), pasando el
 * snapshot por props — el patrón de `src/pages/[server]/server-card.ts`,
 * filtrado a los servidores que tienen esta superficie.
 *
 * @returns Las rutas estáticas, con el id y el snapshot como props.
 */
export const getStaticPaths: GetStaticPaths = () => {
  return Object.entries(actionCatalogs())
    .filter(([, catalog]) => catalog !== undefined)
    .map(([server, catalog]) => ({
      params: { server },
      props: { server, catalog },
    }));
};

/**
 * Emite el índice compacto de un servidor.
 *
 * @param context Contexto de ruta de Astro; `props` es lo que pasó
 *   {@link getStaticPaths}.
 * @returns El índice como `application/json`.
 */
export const GET: APIRoute = ({ props }) => {
  const { server, catalog } = props as {
    server: string;
    catalog: GitlabActionsSnapshot;
  };

  const payload = {
    server,
    // La URI de `resources/read` que este índice refleja, leída del
    // snapshot — nunca literal, para que un cambio aguas arriba fluya solo.
    source: catalog.meta.resourceUri,
    entry_count: catalog.meta.actionCount,
    note: "Counted with a Free-tier token; the catalog is scoped to the token that asks, so tier and token permissions both move the count.",
    // Censo por dominio en el orden del snapshot (por bytes, estable entre
    // builds): la serialización determinista es responsabilidad del extractor
    // (`scripts/sync-server-surface.mjs`) y `src/data/surface.ts` valida la
    // forma — reordenar aquí sería duplicar a su dueño.
    domains: Object.fromEntries(
      catalog.domains.map((d) => [d.domain, d.count]),
    ),
    // Proyección explícita campo a campo: si el snapshot ganara claves
    // nuevas, este endpoint no las publicaría sin que alguien lo decida.
    entries: catalog.entries.map((e) => ({
      id: e.id,
      domain: e.domain,
      title: e.title,
      destructive: e.destructive,
      read_only: e.read_only,
    })),
  };

  return Response.json(payload);
};
