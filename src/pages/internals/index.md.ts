import { internalsMarkdown,markdownResponse } from "../../lib/page-markdown";

/** `/internals/index` — the markdown twin of the internals page. */
export const GET = () => markdownResponse(internalsMarkdown("en"));
