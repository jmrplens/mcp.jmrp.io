import { homeMarkdown,markdownResponse } from "../../lib/page-markdown";

/** `/es/index` — the markdown twin of la portada. */
export const GET = () => markdownResponse(homeMarkdown("es"));
