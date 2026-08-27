import { markdownResponse, homeMarkdown } from "../lib/page-markdown";

/** `/index` — the markdown twin of the home page. */
export const GET = () => markdownResponse(homeMarkdown("en"));
