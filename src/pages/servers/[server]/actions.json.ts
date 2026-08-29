/**
 * The compact index of a server's dynamic action catalog, at
 * `/servers/<id>/actions.json` — the route `/servers.json` and the `llms*.txt`
 * files announce as `index`, and the one the search island consumes.
 *
 * It exists because the real manifest (`gitlab://tools`, ~516 KB) can only be
 * read with a token over JSON-RPC, and no crawler is going to make that call:
 * this file is the static, credential-free view of the same catalog, refreshed
 * on every build by `scripts/sync-server-surface.mjs` with a committed
 * snapshot as a fallback (`src/data/surface/`).
 *
 * What is emitted and what is not: each entry carries `id`, `domain`, `title`,
 * `destructive` and `read_only` — the allowlisted projection the extractor
 * materializes into the snapshot. `kind`, `tool`, `backing_tool`,
 * `backing_action` and `detail_uri` are discarded upstream (`detail_uri` is
 * derivable: the snapshot's `meta.uriTemplate` with the entry's `id`, today
 * `gitlab://tools/{id}`). No pretty-printing: with hundreds of entries the
 * size matters, and the post-build already generates the `.br`/`.gz`.
 *
 * `entry_count` is the number of entries EMITTED (the snapshot's
 * `actionCount`; the upstream `entryCount` also includes the visible-tool
 * entry the projection excludes): the checkable invariant is
 * `entries.length === entry_count`. The "Free-tier" note is attached to the
 * count because the manifest is read with `cacheScope: "private"` — it is
 * THAT token's surface, not the universal one.
 */
import type { APIRoute, GetStaticPaths } from "astro";

import type { GitlabActionsSnapshot } from "../../../data/surface";
import { actionCatalogs } from "../../../data/surface";

/**
 * One route per server WITH a committed catalog (today: gitlab), passing the
 * snapshot through props — the pattern of `src/pages/[server]/server-card.ts`,
 * filtered to the servers that have this surface.
 *
 * @returns The static routes, with the id and the snapshot as props.
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
 * Emits a server's compact index.
 *
 * @param context Astro's route context; `props` is what {@link getStaticPaths}
 *   passed.
 * @returns The index as `application/json`.
 */
export const GET: APIRoute = ({ props }) => {
  const { server, catalog } = props as {
    server: string;
    catalog: GitlabActionsSnapshot;
  };

  const payload = {
    server,
    // The `resources/read` URI this index mirrors, read from the snapshot —
    // never a literal, so an upstream change flows through on its own.
    source: catalog.meta.resourceUri,
    entry_count: catalog.meta.actionCount,
    note: "Counted with a Free-tier token; the catalog is scoped to the token that asks, so tier and token permissions both move the count.",
    // A per-domain census in the snapshot's order (by bytes, stable across
    // builds): deterministic serialization is the extractor's responsibility
    // (`scripts/sync-server-surface.mjs`) and `src/data/surface.ts` validates
    // the shape — reordering here would duplicate its owner.
    domains: Object.fromEntries(
      catalog.domains.map((d) => [d.domain, d.count]),
    ),
    // An explicit field-by-field projection: if the snapshot gained new keys,
    // this endpoint would not publish them without someone deciding to.
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
