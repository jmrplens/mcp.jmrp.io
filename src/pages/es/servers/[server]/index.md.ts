import type { GetStaticPaths } from "astro";

import { servers } from "../../../../data/servers";
import {
  markdownResponse,
  serverMarkdown,
} from "../../../../lib/page-markdown";

/**
 * `/es/servers/<id>/index.md` — the markdown twin of each server's ficha.
 *
 * One route per server via `getStaticPaths`, the same way `[server].astro`
 * builds the pages themselves: a third MCP server gets its twin from the day
 * it lands in `servers.ts`, with nothing to remember here.
 */
export const getStaticPaths = (() =>
  servers.map((server) => ({
    params: { server: server.id },
    props: { server },
  }))) satisfies GetStaticPaths;

/**
 * Renders one server's twin.
 *
 * @param context Astro route context; `props` is what `getStaticPaths` passed.
 * @returns The markdown response.
 */
export const GET = ({
  props,
}: {
  props: { server: (typeof servers)[number] };
}) => markdownResponse(serverMarkdown(props.server, "es"));
