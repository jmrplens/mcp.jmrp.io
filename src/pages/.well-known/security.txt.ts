import type { APIRoute } from "astro";

/**
 * RFC 9116 — a dónde escribir si encuentras un fallo.
 *
 * Un sitio que invita a pegar un Personal Access Token y no dice dónde
 * reportar un problema es incoherente con el resto de su higiene: la auditoría
 * GEO lo marcó como crítico y tenía razón.
 *
 * `Expires` es obligatorio en la RFC y debe estar en el futuro; se calcula a
 * un año del build para que no caduque en silencio: cada despliegue lo renueva.
 */
export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);

  const body = [
    "# Servidores MCP self-hosted — https://mcp.jmrp.io",
    "",
    "Contact: mailto:mail@jmrp.io",
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "Preferred-Languages: es, en",
    "Canonical: https://mcp.jmrp.io/.well-known/security.txt",
    "",
    "# Código del sitio y de los servidores",
    "Policy: https://github.com/jmrplens/mcp.jmrp.io",
    "",
    "# Si el fallo afecta a uno de los servidores MCP, su repositorio tiene",
    "# habilitados los avisos de seguridad privados de GitHub:",
    "#   https://github.com/jmrplens/libgen-mcp/security",
    "#   https://github.com/jmrplens/gitlab-mcp-server/security",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
