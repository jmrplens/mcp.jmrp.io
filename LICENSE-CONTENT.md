# Content license

This repository holds two different kinds of work under one roof, and they are
not licensed the same way. `LICENSE` — the MIT license — covers the **code**:
the Astro pages and components, the inspector and the other Preact islands,
the build integrations, the scripts, and the nginx snippets the build emits.
It does not cover the prose those files render, which is what this file is
for.

Without this split the MIT grant would, on its face, cover every file in the
tree, the site's text included — it lives in `src/i18n/ui/*.ts` and in the
bilingual copy of `src/data/servers.ts`. MIT is the more permissive of the
licenses involved, so anyone who found the repository could rely on it, and
the terms published at <https://mcp.jmrp.io/license/> would be worth nothing.

## The site's text — CC BY 4.0

The prose of the site — every string in `src/i18n/ui/`, the bilingual
descriptions and notices in `src/data/servers.ts`, and everything the build
derives from them (the HTML pages, their markdown twins, `llms.txt` and
`llms-full.txt`) — is licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Republish, translate, quote at any length, in any medium, commercially or not,
provided you credit "José Manuel Requena Plens" and indicate whether you
changed anything. Where the medium allows a link, point it at the page the text
came from. No permission is needed, none can be withdrawn from a copy already
taken under the license, and text-and-data mining is not reserved
(`public/.well-known/tdmrep.json`, and `Content-Signal` in `robots.txt`).

## Server cards and surface snapshots — the servers' own MIT

`src/data/cards/*.json` and `src/data/surface/` are snapshots of what each MCP
server publishes about itself (its server card, its action catalogue). That
text belongs to the server's repository — `jmrplens/libgen-mcp` and
`jmrplens/gitlab-mcp-server`, both MIT — not to this site, and is reproduced
here under that license.

## Files written for programs — no condition

`/servers.json`, `/servers/gitlab/actions.json`, the SEP-2127 connection cards
this site serves at `/<id>/server-card` (not the SEP-1649 catalogue each server
serves at `/<id>/.well-known/mcp/server-card.json`, which the previous section
covers), and the documents under `/.well-known/` list endpoints, tool names,
action ids, headers and URLs. They are facts about the servers, not a
work, and no condition attaches to them.

## What the servers return — not licensed here

Nothing a server returns is covered by any license in this repository: libgen
relays catalogues and files that other people operate, and gitlab relays data
from the caller's own gitlab.com account. See the legal position at
<https://mcp.jmrp.io/policies/#legal-h>.

## Names and logos

Names and logos of third-party products and services that appear on the site
belong to their owners; naming them describes what the deployment does and
implies neither affiliation nor endorsement.

---

The authoritative, human-readable statement of these terms lives at
<https://mcp.jmrp.io/license/> (and <https://mcp.jmrp.io/es/license/> in
Spanish). If this file and that page ever disagree, the page wins and this file
needs fixing.
