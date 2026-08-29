/**
 * MCP client configuration snippets, generated from `servers.ts`.
 *
 * The question that brings people to a hosted endpoint is "how do I add this
 * to my client?", and until now the answer lived off the domain (on each
 * server's documentation site). These builders answer it on the card and in
 * `llms-full.txt` from the same source of truth: a new MCP in `servers.ts`
 * arrives with its snippets already written.
 *
 * The shapes are verified against each client's official documentation
 * (2026-08): Cursor reads `mcpServers` WITHOUT a `type` field (it detects the
 * transport from the URL); VS Code reads `servers` WITH `type: "http"` and
 * asks for secrets through `inputs`; Claude Code takes headers with
 * `--header`. Confusing the two root-level keys is the classic mistake, which
 * is why every snippet names its file.
 */
import type { McpHeader, McpServer } from "../data/servers";
import type { Lang } from "../i18n/ui";

/** The suggested environment-variable name for a server's secret. */
function tokenEnv(server: McpServer): string {
  return `${server.id.toUpperCase()}_TOKEN`;
}

/** The headers the snippet must fill in: the required ones only. */
function required(server: McpServer): McpHeader[] {
  return server.requiredHeaders;
}

/**
 * The value that goes INSIDE the header, scheme included.
 *
 * It exists because gitlab moved to OAuth: its credential travels in
 * `Authorization`, whose value is `Bearer ` + the token, not the bare token.
 * The three generators below pasted the raw value after `<name>: `, so
 * without this they would emit `Authorization: <your token>` — invalid
 * syntax, and a 401 for anyone who copied the snippet.
 *
 * @param header The header from `src/data/servers.ts`.
 * @param value What the visitor supplies (or its placeholder).
 * @returns The complete header value.
 */
function headerValue(header: McpHeader, value: string): string {
  return `${header.valuePrefix ?? ""}${value}`;
}

/**
 * Registering from the command line in Claude Code.
 *
 * The value goes in as the literal placeholder `<your token>` and not as
 * `${VAR}`: inside double quotes the shell would expand the variable BEFORE
 * the client ever saw it, and what got stored would be the resolved token, not
 * the reference.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns The complete command, ready to copy.
 */
export function claudeCodeCommand(server: McpServer): string {
  const headers = required(server)
    .map(
      (header) =>
        ` --header "${header.name}: ${headerValue(header, "<your token>")}"`,
    )
    .join("");
  return `claude mcp add --transport http ${server.id} ${server.endpoint}${headers}`;
}

/**
 * The block for `~/.cursor/mcp.json` (or the project's `.cursor/mcp.json`).
 *
 * No `type` field: Cursor detects streamable HTTP itself. `${env:VAR}` is
 * Cursor's documented interpolation and keeps the token out of the file.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns Indented JSON, ready to copy.
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
 * The block for `.vscode/mcp.json` (or the user profile's `mcp.json`).
 *
 * Root key `servers` — not `mcpServers` — and `type: "http"` is mandatory.
 * Secrets go in as `promptString` `inputs`: VS Code asks for them once and
 * stores them itself, never in the file.
 *
 * @param server A server from `src/data/servers.ts`.
 * @param lang The language of the prompt text whoever pastes it will see.
 * @returns Indented JSON, ready to copy.
 */
export function vscodeJson(server: McpServer, lang: Lang): string {
  const headers = required(server);
  // Deliberately NOT derived from the header's name: with `Authorization` the
  // id would come out as `gitlab-authorization`, which names the envelope
  // rather than what the user is being asked for. `-token` describes what has
  // to be typed, and it also survives the header being renamed again.
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
              headers.map((h) => [
                h.name,
                headerValue(h, `\${input:${inputId()}}`),
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

/* ===== Registering through OAuth =============================================
   The three forms above paste the credential by hand. These three are the path
   the deployment recommends when the server delegates to OAuth: the client does
   the dance (Authorization Code + PKCE) against the authorization server the
   RFC 9728 document announces, and the visitor never sees a token.

   The `clientId` is MANDATORY and not an ornament: without it these clients
   fall back to dynamic registration, which on GitLab hands out a token with the
   `mcp` scope — a scope that cannot move the REST API this server is built on,
   so every action would fail. Its own guide says so, and that is why the field
   travels in `servers.ts` rather than being left to the reader.

   The shapes come from the server's own docs/guides/ide-configuration.md, not
   from deduction: Cursor is a VS Code fork and shares the `oauth` object, but
   the top-level key is NOT the same (`mcpServers` versus `servers`), which is
   the classic mistake when copying one client's block into another. */

/**
 * Registering through OAuth in Claude Code.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns The command, or `undefined` when the server does not delegate to
 *   OAuth.
 */
export function claudeCodeOauthCommand(server: McpServer): string | undefined {
  const oauth = server.oauth;
  if (!oauth) return undefined;
  return `claude mcp add ${server.id} --transport http --client-id ${oauth.clientId} --callback-port ${oauth.callbackPort} ${server.endpoint}`;
}

/**
 * The OAuth block for `.cursor/mcp.json`.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns Indented JSON, or `undefined` when the server does not delegate to
 *   OAuth.
 */
export function cursorOauthJson(server: McpServer): string | undefined {
  const oauth = server.oauth;
  if (!oauth) return undefined;
  return JSON.stringify(
    {
      mcpServers: {
        [server.id]: {
          type: "http",
          url: server.endpoint,
          oauth: { clientId: oauth.clientId, scopes: oauth.scopes },
        },
      },
    },
    null,
    2,
  );
}

/**
 * The OAuth block for `.vscode/mcp.json`.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns Indented JSON, or `undefined` when the server does not delegate to
 *   OAuth.
 */
export function vscodeOauthJson(server: McpServer): string | undefined {
  const oauth = server.oauth;
  if (!oauth) return undefined;
  return JSON.stringify(
    {
      servers: {
        [server.id]: {
          type: "http",
          url: server.endpoint,
          oauth: { clientId: oauth.clientId, scopes: oauth.scopes },
        },
      },
    },
    null,
    2,
  );
}
