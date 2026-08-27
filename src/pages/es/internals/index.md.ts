import { markdownResponse, internalsMarkdown } from "../../../lib/page-markdown";

/** `/es/internals/index` — the markdown twin of la página de funcionamiento interno. */
export const GET = () => markdownResponse(internalsMarkdown("es"));
