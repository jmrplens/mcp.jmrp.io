/**
 * Fragmentos de configuración de clientes MCP, generados de `servers.ts`.
 *
 * La pregunta que trae a la gente a un endpoint alojado es «¿cómo lo añado a
 * mi cliente?», y hasta ahora la respuesta vivía fuera del dominio (en los
 * sitios de documentación de cada servidor). Estos builders la contestan en
 * la ficha y en `llms-full.txt` desde la misma fuente de verdad: un MCP nuevo
 * en `servers.ts` sale con sus fragmentos ya escritos.
 *
 * Las formas están verificadas contra la documentación oficial de cada
 * cliente (2026-08): Cursor lee `mcpServers` SIN campo `type` (autodetecta el
 * transporte por la URL); VS Code lee `servers` CON `type: "http"` y pide los
 * secretos con `inputs`; Claude Code toma cabeceras con `--header`. Confundir
 * las dos claves de nivel raíz es el error clásico, por eso cada fragmento
 * nombra su fichero.
 */
import type { McpHeader, McpServer } from "../data/servers";
import type { Lang } from "../i18n/ui";

/** Nombre de variable de entorno sugerido para el secreto de un servidor. */
function tokenEnv(server: McpServer): string {
  return `${server.id.toUpperCase()}_TOKEN`;
}

/** Cabeceras que el fragmento debe rellenar: solo las obligatorias. */
function required(server: McpServer): McpHeader[] {
  return server.requiredHeaders;
}

/**
 * El valor que va DENTRO de la cabecera, esquema incluido.
 *
 * Existe desde que gitlab pasó a OAuth: su credencial viaja en
 * `Authorization`, cuyo valor es `Bearer ` + el token, no el token a secas.
 * Los tres generadores de abajo pegaban el valor crudo detrás de
 * `<nombre>: `, así que sin esto emitirían `Authorization: <your token>` —
 * sintaxis inválida, y un 401 para quien copiara el fragmento.
 *
 * @param header La cabecera de `src/data/servers.ts`.
 * @param value Lo que aporta el visitante (o su marcador).
 * @returns El valor completo de la cabecera.
 */
function headerValue(header: McpHeader, value: string): string {
  return `${header.valuePrefix ?? ""}${value}`;
}

/**
 * Alta por línea de comandos en Claude Code.
 *
 * El valor va como marcador literal `<your token>` y no como `${VAR}`: dentro
 * de comillas dobles la shell expandiría la variable ANTES de que el cliente
 * la viera, y lo almacenado sería el token resuelto, no la referencia.
 *
 * @param server Servidor de `src/data/servers.ts`.
 * @returns El comando completo, listo para copiar.
 */
export function claudeCodeCommand(server: McpServer): string {
  const headers = required(server)
    .map((header) => ` --header "${header.name}: ${headerValue(header, "<your token>")}"`)
    .join("");
  return `claude mcp add --transport http ${server.id} ${server.endpoint}${headers}`;
}

/**
 * Bloque para `~/.cursor/mcp.json` (o `.cursor/mcp.json` del proyecto).
 *
 * Sin campo `type`: Cursor autodetecta streamable HTTP. `${env:VAR}` es la
 * interpolación documentada de Cursor y mantiene el token fuera del fichero.
 *
 * @param server Servidor de `src/data/servers.ts`.
 * @returns JSON indentado, listo para copiar.
 */
export function cursorJson(server: McpServer): string {
  const headers = required(server);
  return JSON.stringify(
    {
      mcpServers: {
        [server.id]: {
          url: server.endpoint,
          ...(headers.length > 0 && {
            headers: Object.fromEntries(
              headers.map((h) => [
                h.name,
                headerValue(h, `\${env:${tokenEnv(server)}}`),
              ]),
            ),
          }),
        },
      },
    },
    null,
    2,
  );
}

/**
 * Bloque para `.vscode/mcp.json` (o el `mcp.json` del perfil de usuario).
 *
 * Clave raíz `servers` —no `mcpServers`— y `type: "http"` obligatorio. Los
 * secretos van como `inputs` de tipo `promptString`: VS Code los pide una vez
 * y los guarda él mismo, nunca en el fichero.
 *
 * @param server Servidor de `src/data/servers.ts`.
 * @param lang Idioma del texto del prompt que verá quien lo pegue.
 * @returns JSON indentado, listo para copiar.
 */
export function vscodeJson(server: McpServer, lang: Lang): string {
  const headers = required(server);
  // Deliberadamente NO se deriva del nombre de la cabecera: con `Authorization`
  // el id saldría `gitlab-authorization`, que nombra el sobre en vez de lo que
  // se le pide al usuario. `-token` describe lo que hay que teclear, y además
  // no cambia si la cabecera se renombra otra vez.
  const inputId = (): string => `${server.id}-token`;

  return JSON.stringify(
    {
      ...(headers.length > 0 && {
        inputs: headers.map((header) => ({
          type: "promptString",
          id: inputId(),
          description: header.description[lang],
          password: header.secret === true,
        })),
      }),
      servers: {
        [server.id]: {
          type: "http",
          url: server.endpoint,
          ...(headers.length > 0 && {
            headers: Object.fromEntries(
              headers.map((h) => [h.name, headerValue(h, `\${input:${inputId()}}`)]),
            ),
          }),
        },
      },
    },
    null,
    2,
  );
}
