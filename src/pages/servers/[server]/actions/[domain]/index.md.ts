import type { GetStaticPaths } from "astro";

import { actionsDomainPaths } from "../../../../../data/surface";
import {
  domainMarkdown,
  markdownResponse,
} from "../../../../../lib/page-markdown";

/**
 * `/servers/<server>/actions/<domain>/index.md` — the markdown twin of each
 * action-domain page.
 *
 * These are the twins that carry the most: thirty pages holding the whole
 * 851-action catalog, which an agent would otherwise have to read through the
 * HTML of a filter island. Same `actionsDomainPaths()` the pages themselves
 * use, so the two cannot list different domains.
 */
export const getStaticPaths = (() =>
  actionsDomainPaths()) satisfies GetStaticPaths;

/**
 * Renders one domain's twin.
 *
 * @param context Astro route context; `props` is what `getStaticPaths` passed.
 * @returns The markdown response.
 */
export const GET = ({
  props,
}: {
  props: ReturnType<typeof actionsDomainPaths>[number]["props"];
}) =>
  markdownResponse(
    domainMarkdown(
      props.server,
      props.domain,
      props.actions,
      props.domainOf,
      "en",
    ),
  );
