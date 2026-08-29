import type { APIRoute } from "astro";

/**
 * RFC 9116 — where to write if you find a flaw.
 *
 * A site that invites you to paste a Personal Access Token and does not say
 * where to report a problem is inconsistent with the rest of its hygiene: the
 * GEO audit flagged it as critical and was right.
 *
 * `Expires` is mandatory in the RFC and has to be in the future; it is computed
 * a year out from the build so it cannot lapse silently: every deployment
 * renews it.
 */
export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);

  const body = [
    "# Self-hosted MCP servers — https://mcp.jmrp.io",
    "",
    "Contact: mailto:mail@jmrp.io",
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "Preferred-Languages: es, en",
    "Canonical: https://mcp.jmrp.io/.well-known/security.txt",
    "",
    "# Source for the site and the servers",
    "Policy: https://github.com/jmrplens/mcp.jmrp.io",
    "",
    "# If the flaw affects one of the MCP servers, its repository has",
    "# GitHub private security advisories enabled:",
    "#   https://github.com/jmrplens/libgen-mcp/security",
    "#   https://github.com/jmrplens/gitlab-mcp-server/security",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
