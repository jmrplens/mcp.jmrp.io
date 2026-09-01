# mcp.jmrp.io

Public site for the self-hosted **Model Context Protocol** servers of
[jmrp.io](https://jmrp.io): which endpoints exist, how to use them, and an
inspector to try them from the browser.

**[mcp.jmrp.io](https://mcp.jmrp.io)** · [Español](https://mcp.jmrp.io/es/)

## The servers

| Endpoint                     | Repository                                                         | Credentials                                          |
| ---------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `https://mcp.jmrp.io/libgen` | [libgen-mcp](https://github.com/jmrplens/libgen-mcp)               | None                                                 |
| `https://mcp.jmrp.io/gitlab` | [gitlab-mcp-server](https://github.com/jmrplens/gitlab-mcp-server) | `Authorization: Bearer` per request (OAuth or a PAT) |

Transport is **streamable HTTP**. `https://mcp.jmrp.io/servers.json` returns
the same list as JSON for automated clients.

### Configuring an MCP client

```json
{
  "mcpServers": {
    "libgen": { "type": "http", "url": "https://mcp.jmrp.io/libgen" },
    "gitlab": {
      "type": "http",
      "url": "https://mcp.jmrp.io/gitlab",
      "headers": { "Authorization": "Bearer glpat-xxxxxxxxxxxx" }
    }
  }
}
```

The endpoint runs in OAuth mode and is fixed to `https://gitlab.com`: an
unauthenticated call answers `401` with a `WWW-Authenticate` challenge naming
[`/.well-known/oauth-protected-resource/gitlab`](https://mcp.jmrp.io/.well-known/oauth-protected-resource/gitlab),
the RFC 9728 document that says which authorization server issues its tokens. A
personal access token sent as `Authorization: Bearer` works the same way, which
is the path for headless and CI use.

> Tokens travel with each request and are **never stored on the server**. The
> inspector on this site keeps them in browser memory only: it touches neither
> `localStorage` nor cookies, and they are gone on reload.
>
> A `GET` on an endpoint never returns a page: libgen rejects the method with
> **405**, and gitlab checks credentials before the method, so it answers
> **401**. In _stateless_ mode the protocol reserves `GET`/`DELETE` for
> sessions. The server is not down — use `POST`, or `/libgen/health` and
> `/gitlab/health` to check status.

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev
```

| Command                            | What it does                              |
| ---------------------------------- | ----------------------------------------- |
| `pnpm build`                       | Build into `dist/`                        |
| `pnpm deploy`                      | Build + nginx snippets + Cloudflare purge |
| `pnpm lint` · `pnpm typecheck`     | eslint · astro check                      |
| `pnpm test:unit` · `pnpm test:e2e` | node:test · Playwright                    |
| `pnpm identity:sync`               | Refresh the canonical identity snapshot   |

The e2e tests call the **real endpoints** in production: that is intentional —
they validate the full path. Without Internet access, `E2E_NO_NETWORK=1`
skips them.

## The inspector

Three tabs — **tools**, **prompts** and **resources** — with the same
mechanics: load the catalog, pick an entry and run it. Arguments are collected
through a form generated from the server's schema, showing each field's type,
which ones are required, and dropdowns for enumerated values. For schemas no
form represents well, there is a JSON mode.

## How it is built

A static Astro site with three Preact islands (the inspector, the action search on the server pages and the domain filter on the action pages). It is served by
nginx on the same host as the MCP servers, which hang off the same domain:
that is why the inspector talks to them **same-origin** and the CSP never
needs to open `connect-src`.

The CSP uses per-request nonces: the build leaves a placeholder and nginx
substitutes it, with a Cloudflare Worker minting a fresh one at the edge
without breaking the cache.

The `Person` node in the metadata is downloaded at build time from the
[canonical jmrp.io document](https://jmrp.io/identity/person.jsonld), like on
the other documentation sites, with a committed snapshot as fallback.

## Adding an MCP server

One entry in `src/data/servers.ts` and its `location` in the vhost. No
markup: the server cards, the inspector, `servers.json` and `llms.txt` are
all generated from there.

Project details and constraints live in [AGENTS.md](AGENTS.md).

## License

| What                                                                                                          | License                                                             |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The code: pages, components, islands, build integrations, scripts                                             | [MIT](LICENSE)                                                      |
| The site's text (`src/i18n/ui/`, the copy in `src/data/servers.ts`, and everything the build derives from it) | [CC BY 4.0](LICENSE-CONTENT.md)                                     |
| Server cards and surface snapshots (`src/data/cards/`, `src/data/surface/`)                                   | The servers' own MIT — see [LICENSE-CONTENT.md](LICENSE-CONTENT.md) |
| What the servers return                                                                                       | Not licensed here — see <https://mcp.jmrp.io/policies/#legal-h>     |

The human-readable statement is <https://mcp.jmrp.io/license/>.
