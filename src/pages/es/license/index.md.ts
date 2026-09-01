import { licenseMarkdown, markdownResponse } from "../../../lib/page-markdown";

/** `/es/license/index` — the markdown twin of the Spanish license page. */
export const GET = () => markdownResponse(licenseMarkdown("es"));
