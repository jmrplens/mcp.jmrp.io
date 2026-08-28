import { inspectorMarkdown,markdownResponse } from "../../lib/page-markdown";

/** `/inspector/index` — the markdown twin of the inspector. */
export const GET = () => markdownResponse(inspectorMarkdown("en"));
