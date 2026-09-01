import { licenseMarkdown, markdownResponse } from "../../lib/page-markdown";

/** `/license/index` — the markdown twin of the license page. */
export const GET = () => markdownResponse(licenseMarkdown("en"));
