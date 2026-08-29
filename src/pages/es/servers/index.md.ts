import {
  markdownResponse,
  serversIndexMarkdown,
} from "../../../lib/page-markdown";

/** `/es/servers/index` — the markdown twin of the servers index. */
export const GET = () => markdownResponse(serversIndexMarkdown("es"));
