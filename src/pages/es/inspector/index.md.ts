import { inspectorMarkdown,markdownResponse } from "../../../lib/page-markdown";

/** `/es/inspector/index` — the markdown twin of el inspector. */
export const GET = () => markdownResponse(inspectorMarkdown("es"));
