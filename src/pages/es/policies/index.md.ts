import { markdownResponse, policiesMarkdown } from "../../../lib/page-markdown";

/** `/es/policies/index` — the markdown twin of the policies page. */
export const GET = () => markdownResponse(policiesMarkdown("es"));
