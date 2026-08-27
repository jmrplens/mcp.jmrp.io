import { markdownResponse, policiesMarkdown } from "../../../lib/page-markdown";

/** `/es/policies/index` — the markdown twin of la página de políticas. */
export const GET = () => markdownResponse(policiesMarkdown("es"));
