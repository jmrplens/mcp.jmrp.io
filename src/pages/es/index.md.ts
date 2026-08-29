import { homeMarkdown, markdownResponse } from "../../lib/page-markdown";

/** `/es/index` — the markdown twin of the home page. */
export const GET = () => markdownResponse(homeMarkdown("es"));
