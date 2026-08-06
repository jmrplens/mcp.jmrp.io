/**
 * Única fuente de verdad de la lista de servidores MCP.
 *
 * La consumen las páginas (`src/pages/index.astro`, `src/pages/es/index.astro`),
 * el índice para máquinas (`/servers.json`) y el inspector. Añadir un MCP nuevo
 * empieza SIEMPRE por una entrada aquí.
 */

export type McpHeader = {
  name: string;
  description: { en: string; es: string };
  /**
   * La cabecera lleva una credencial. El inspector pinta esos campos como
   * `type="password"` y nunca los persiste. Marcarlo aquí —y no por el nombre
   * de la cabecera— evita que un MCP nuevo se quede con el token a la vista.
   */
  secret?: boolean;
  /** Ejemplo que se muestra en el campo del inspector. Nunca un valor real. */
  placeholder?: string;
};

export type McpServer = {
  id: string;
  name: string;
  endpoint: string;
  repo: string;
  docs: string;
  /** Cabeceras que el cliente DEBE enviar. Vacío = sin credenciales. */
  requiredHeaders: McpHeader[];
  optionalHeaders: McpHeader[];
  description: { en: string; es: string };
};

export const servers: McpServer[] = [
  {
    id: "libgen",
    name: "libgen",
    endpoint: "https://mcp.jmrp.io/libgen",
    repo: "https://github.com/jmrplens/libgen-mcp",
    docs: "https://github.com/jmrplens/libgen-mcp#readme",
    requiredHeaders: [],
    optionalHeaders: [],
    description: {
      en: "Search, download and read books, papers and comics from Library Genesis, plus keyless open-access discovery (arXiv, Crossref, OpenLibrary, Gutenberg, dblp, PubMed, ERIC). No account required.",
      es: "Busca, descarga y lee libros, artículos y cómics de Library Genesis, más descubrimiento de acceso abierto sin claves (arXiv, Crossref, OpenLibrary, Gutenberg, dblp, PubMed, ERIC). No requiere cuenta.",
    },
  },
  {
    id: "gitlab",
    name: "gitlab",
    endpoint: "https://mcp.jmrp.io/gitlab",
    repo: "https://github.com/jmrplens/gitlab-mcp-server",
    docs: "https://github.com/jmrplens/gitlab-mcp-server#readme",
    requiredHeaders: [
      {
        name: "PRIVATE-TOKEN",
        secret: true,
        description: {
          en: "Your GitLab Personal Access Token. Never stored on the server.",
          es: "Tu Personal Access Token de GitLab. Nunca se guarda en el servidor.",
        },
      },
    ],
    optionalHeaders: [
      {
        name: "GITLAB-URL",
        placeholder: "https://gitlab.com",
        description: {
          en: "Another GitLab instance. Defaults to https://gitlab.com.",
          es: "Otra instancia de GitLab. Por defecto https://gitlab.com.",
        },
      },
    ],
    description: {
      en: "Projects, merge requests, issues, pipelines, releases and more against any GitLab instance. Your token travels per request and is never stored.",
      es: "Proyectos, merge requests, incidencias, pipelines, releases y más contra cualquier instancia de GitLab. Tu token viaja en cada petición y nunca se guarda.",
    },
  },
];
