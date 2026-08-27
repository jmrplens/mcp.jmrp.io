import { markdownResponse, serversIndexMarkdown } from "../../../lib/page-markdown";

/** `/es/servers/index` — the markdown twin of el índice de servidores. */
export const GET = () => markdownResponse(serversIndexMarkdown("es"));
