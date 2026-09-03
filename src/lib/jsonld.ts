/**
 * The site's JSON-LD graph.
 *
 * One `@graph` per page. These are its main nodes; the rest (`FAQPage`,
 * `SoftwareSourceCode`) are documented at their own builder:
 *
 *   - `WebSite`  — the whole site, once for both language versions.
 *   - `WebPage`  — this particular page (one `@id` per language).
 *   - `WebAPI`   — ONE server's node, and ONLY on the page that describes
 *     it: its own card at `/servers/<id>/` (in both languages). Any other
 *     page that needs to mention it — the home page, `/servers/` — does not
 *     restate its data: it REFERENCES it by `@id` (the FAQ's `about`) or
 *     identifies it with a PARTIAL four-key description (`mainEntity`, see
 *     `partialApi`). That description is still not a redefinition: its four
 *     keys come from the SAME `servers.ts` entry as the full node's, so they
 *     cannot contradict it, and any fact that decides something — license,
 *     tools, actions — is still asserted in exactly one place. It used to be
 *     redefined in full on the home page AND on `/servers/`, and did not
 *     exist at all on the card that describes it: the entity split into two
 *     copies that could drift, on the wrong page. See `buildApiNode` below
 *     and `servers-section-spec.md`, under what it drags along.
 *   - `BreadcrumbList` — the path from the root down to this page, on every
 *     page but the home one. See `breadcrumbSteps`.
 *   - `Person`   — jmrp.io's canonical node, spliced in verbatim.
 *
 * Every node of ours points at the person by `@id`
 * (`publisher`/`author`/`provider`), never by restating their data: the
 * identity document is the single source of truth for who the author is, and
 * duplicating it here would guarantee the two copies drift apart. The same
 * principle — reference without redefining — now governs the `WebAPI` node
 * too.
 *
 * The `person.jsonld` document is NOT published on this domain: the vhost
 * serves by a `location =` allowlist and adding an entry would mean editing
 * /etc/nginx by hand. Its dereferenceable URL is still jmrp.io's.
 */
import { serverCards } from "../data/server-cards";
import type { McpNotice, McpServer } from "../data/servers";
import { servers } from "../data/servers";
import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { loadPersonNode, PERSON_ID } from "./identity";
import {
  actionsDomainPageUrl,
  DEFAULT_LANG,
  LANGS,
  OG_IMAGE_SIZE,
  ogImageUrl,
  type PageId,
  pageUrl,
  serverPageUrl,
  SITE_NAME,
  SITE_ORIGIN,
} from "./seo";
import { pageDatesOf } from "./sitemap-lastmod";

// Each page's own dates, from the git history of the files that page is made
// of. Built once: it memoizes per source set, and the graph is rendered 73
// times per build.
//
// This REPLACES the two site-wide constants this file used to keep. HEAD's
// commit date was stamped on all 73 pages, so the graph said the whole site
// changed whenever any commit landed; and the repository's first commit was
// stamped as every page's `datePublished`, so /license/ claimed to have
// existed on 2026-08-06, weeks before it was written. The footer and
// `<UpdatedLine>` still use `buildDate()` — a site-wide date is the honest one
// there, because that line is about the deployment.

/** `@id` of the `WebSite` node the pages hang off through `isPartOf`. */
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

/** One literal per language, for nodes that share an `@id`. */
type LocalizedValue = { "@value": string; "@language": Lang };

/**
 * Turns an EN/ES pair into language-tagged literals.
 *
 * The `WebSite` and `WebAPI` nodes are emitted with the SAME `@id` from both
 * pages; if their `description` were a bare string, each language would
 * assert a different value for the same property of the same node. Tagging
 * the language turns that collision into what it actually is: bilingual text.
 */
function localized(values: { en: string; es: string }): LocalizedValue[] {
  return [
    { "@value": values.en, "@language": "en" },
    { "@value": values.es, "@language": "es" },
  ];
}

/**
 * A node's `dateModified`/`datePublished` pair, ready to spread.
 *
 * Each is omitted rather than emitted empty when git cannot answer — a missing
 * date is a gap, an invented one is a false claim, and this file already
 * carries the rule that it does not assert what it cannot verify.
 *
 * @param pathname The page whose sources date the node.
 * @returns The keys to spread into the node.
 */
function datesOf(pathname: string): Record<string, string> {
  const { dateModified, datePublished } = pageDatesOf(pathname);
  return {
    ...(dateModified && { dateModified }),
    ...(datePublished && { datePublished }),
  };
}

/** The dates of one server's node, from its card page. */
function apiDates(server: McpServer): Record<string, string> {
  return datesOf(new URL(serverPageUrl(DEFAULT_LANG, server.id)).pathname);
}

/**
 * The `TechArticle` a prose page IS, or null when the page is not one.
 *
 * `mainEntity` and not `hasPart` at the call site: on these three pages
 * nothing else claims that slot (see `selectMainEntity`), and the document is
 * the page's primary entity rather than a part of it.
 *
 * @param context The page's identity, dates and the servers it is about.
 * @returns The node, or null.
 */
function buildArticleNode(context: {
  page: PageId;
  lang: Lang;
  url: string;
  articleId: string;
  description: string;
  dates: Record<string, string>;
  apiPartials: Record<string, unknown>[];
}): Record<string, unknown> | null {
  const { page, lang, url, articleId, description, dates, apiPartials } =
    context;
  if (!PROSE_PAGES.has(page)) return null;
  return {
    "@type": "TechArticle",
    "@id": articleId,
    headline: pageLabels(lang)[page],
    description,
    inLanguage: lang,
    isPartOf: ref(`${url}#webpage`),
    mainEntityOfPage: ref(`${url}#webpage`),
    author: ref(PERSON_ID),
    publisher: ref(PERSON_ID),
    // The card's URL, not a reference to the image node the page declares:
    // schema.org takes a URL for `image`, and the alternative — giving that
    // node an `@id` and pointing at it — makes the graph-cohesion test read
    // the declaration itself as a dangling reference, since it collects only
    // top-level nodes. The licensing block stays stated once, on the page.
    image: ogImageUrl(lang),
    ...dates,
    // The prose, like every other page's, is CC BY 4.0 — see /license/.
    license: CC_BY_4_0,
    // The partial nodes, not bare refs: these pages carry no `WebAPI` of their
    // own, and an `@id` alone would name an entity that lives on another page
    // and answers 401/405 when dereferenced — the very thing
    // `selectMainEntity` refuses to do. Home and /servers/ can use bare refs
    // for their FAQ because `mainEntity` already puts the partials in the
    // same document.
    about: apiPartials,
  };
}

/**
 * Pages that are a written document rather than an interface.
 *
 * /internals/ is ~2,700 words in nine authored sections; /policies/ and
 * /license/ are the same shape. They were typed `WebPage` and nothing else,
 * so nothing in the graph said they were articles with a thesis, and they
 * were ineligible for the one rich result that still applies to them.
 *
 * The home page, `/servers/`, the server cards, the action pages and
 * /inspector/ are deliberately absent: those are indexes and interfaces, and
 * calling them articles would be the kind of stretch this file avoids.
 */
const PROSE_PAGES = new Set<PageId>(["internals", "license", "policies"]);

/** A reference to a node declared elsewhere (here or in the identity doc). */
function ref(id: string): { "@id": string } {
  return { "@id": id };
}

/** `@id` of a server's `WebAPI`/`SoftwareApplication` node. */
function apiId(server: McpServer): string {
  return `${server.endpoint}#api`;
}

/**
 * `@id` of a server's `SoftwareSourceCode` node.
 *
 * `#source-code`, NEVER `#software`: jmrp.io/projects already defines that
 * IRI as a `SoftwareApplication` with a different name and license, and
 * describing the same `@id` with contradictory data from two pages makes the
 * merged entity contradict itself — the regression this file already suffered
 * and that `#source-code` exists to avoid repeating. See the long comment in
 * {@link buildSourceNode}.
 */
function sourceId(server: McpServer): string {
  return `${server.repo}#source-code`;
}

/**
 * The license IRI of both MCPs, shared by the endpoint node and the code one.
 *
 * The same one jmrp.io/projects uses, not SPDX's: in RDF they are different
 * resources, and this domain's entities have to tell the same story as the
 * canonical ones. One constant and not two literals because both nodes
 * describe the same software: were they to diverge, the graph would say the
 * endpoint and its code are under different licenses.
 *
 * It is a FIXED value, not server data. A third MCP under another license
 * would turn it into a silent lie, so that day the field has to move down to
 * `src/data/servers.ts` — where `repo` and `docs` already live — rather than
 * a second literal being added here.
 */
const MIT_LICENSE = "https://opensource.org/licenses/MIT";

/**
 * The license the site's own social cards carry, for `primaryImageOfPage`.
 *
 * The canonical URI and NOT the localized `deed.es` that `license.ts` gives
 * the Spanish page: that link exists for a human to read, this value is an
 * identifier a consumer matches, and the same image must not appear to be
 * under two licenses depending on which language rendered the page.
 */
const CC_BY_4_0 = "https://creativecommons.org/licenses/by/4.0/";

/** Repository facts this domain copies from the canonical publisher. */
interface SourceFacts {
  name: string;
  programmingLanguage: string;
}

/**
 * A VERBATIM copy of what each repo's documentation site publishes for its
 * `#source-code` `@id`. See {@link buildSourceNode} for why they have to match
 * letter for letter.
 *
 * `name` is NOT derivable: gitlab's canonical says "GitLab MCP Server source
 * code", and deriving it from the repo slug would give "gitlab-mcp-server
 * source code" — a DIFFERENT value for the same `@id`, which is exactly the
 * entity split {@link sourceId} exists to avoid repeating.
 *
 * Their natural home is `src/data/servers.ts`, next to `repo`: they are
 * server data, not graph data. They are here because moving them there
 * changes the shape of the public `McpServer` type, which is a separate
 * decision. A server absent from this map goes without these two facts, and
 * that is correct: the canonical's values are checked, not guessed, and
 * asserting an invented `name` splits the entity in two, which is worse than
 * asserting none.
 */
const SOURCE_FACTS: Record<string, SourceFacts | undefined> = {
  gitlab: {
    name: "GitLab MCP Server source code",
    programmingLanguage: "Go",
  },
  libgen: { name: "libgen-mcp source code", programmingLanguage: "Go" },
};

/**
 * The two types of an endpoint's node.
 *
 * Shared — not repeated — between the FULL node ({@link buildApiNode}) and the
 * partial description ({@link partialApi}): a type added to only one would
 * leave the other describing the SAME entity with fewer types, which is the
 * silent drift this whole file is built against.
 */
const API_TYPES = ["WebAPI", "SoftwareApplication"] as const;

/**
 * Builds ONE server's full `WebAPI`/`SoftwareApplication` node.
 *
 * Only called from `buildSiteGraph` when the page being rendered IS that
 * server's card (`meta.serverId` matches) — the entity lives where it is
 * described. Any other page that needs to mention it uses {@link partialApi}
 * (or a bare reference) instead of calling this again: that is what keeps a
 * single place holding the real data and stops two pages asserting different
 * things about the same `@id`.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns The node, ready for the `@graph`.
 */
function buildApiNode(server: McpServer): Record<string, unknown> {
  return {
    // Multi-typed on purpose: `WebAPI` hangs off `Intangible`, so on its own
    // it rules out `license`, `dateModified` and `isAccessibleForFree` — which
    // are precisely the facts that decide whether an assistant recommends an
    // endpoint. Adding `SoftwareApplication` (the `CreativeWork` branch)
    // enables them without giving up the precise "this is an API" semantics.
    "@type": API_TYPES,
    "@id": apiId(server),
    name: server.name,
    url: server.endpoint,
    // The `@id` is the endpoint's IRI, and the endpoint only speaks POST: a
    // consumer that dereferences it gets 405 from libgen and 401 from gitlab,
    // by design. So the node also names the document that DOES describe it
    // and answers 200 — its own server card. The `@id` itself must not move:
    // jmrp.io's canonical person.jsonld lists both of them in `owns`, and six
    // external consumers read that file.
    mainEntityOfPage: ref(`${serverPageUrl(DEFAULT_LANG, server.id)}#webpage`),
    description: localized(server.description),
    documentation: server.docsSite ?? server.docs,
    serviceType: "Model Context Protocol server",
    // The same Wikidata anchor as the author's `knowsAbout` — and with the
    // SAME `http://` scheme, which is Wikidata's canonical concept URI and the
    // one jmrp.io already uses. With `https://` the graph declared two
    // different resources for the same concept.
    // semantics schema.org actually documents.
    //
    // A NODE and not a bare string: schema.org's JSON-LD context gives `about`
    // no `"@type": "@id"` coercion, so a string expands to a text literal and
    // the link to the entity never exists — the graph would be claiming this
    // endpoint is about a piece of text that happens to look like a URL. The
    // node form is the one the identity document already uses for this very
    // Q-id in `knowsAbout`.
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- Not a link: it is Wikidata's canonical CONCEPT IRI, which uses http:// by definition (the site serves https, the identifier does not change). With https it would be a different RDF resource from the one knowsAbout and jmrp.io already use — and in fact eslint --fix silently "corrected" it once and split the entity in two. If Prettier ever breaks this line, the disable MUST move down to whichever line carries the string.
    about: { "@id": "http://www.wikidata.org/entity/Q133436854" },
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (HTTP)",
    // The version the endpoint actually runs, from the same committed card
    // the page and the twin print, with `server.version` as the fallback that
    // field is documented to be. Without it the only version reachable in the
    // merged graph was the one the software's own node publishes — a release
    // number that says nothing about what is deployed here, and today does
    // not even match it.
    softwareVersion:
      serverCards[server.id]?.serverInfo.version ?? server.version,
    license: MIT_LICENSE,
    isAccessibleForFree: true,
    // This server's dates, taken from its own card page: the node describes
    // one endpoint, so the repository's HEAD said nothing about it. The `@id`
    // is shared by both languages, so the path is resolved in the default one
    // — the resolver strips the language prefix anyway, since a page and its
    // translation are built from the same sources.
    ...apiDates(server),
    // What it can do, without running the endpoint: the question an agent asks
    // about an MCP server, and until now only a live `tools/list` answered it.
    featureList: server.tools.map((tool) => tool.name),
    offers: {
      "@type": "Offer",
      // `url` is the recommended property that was missing: where the offered
      // thing is obtained. For a free endpoint, the endpoint itself.
      url: server.endpoint,
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    // The terms the prose states and the graph did not. `isAccessibleForFree`
    // and `availability: InStock` together read as an unconditional
    // invitation, while /policies/ says the opposite in detail: no SLA, and no
    // commitment that either endpoint stays online — or unchanged — from one
    // day to the next. An agent deciding whether to build on this endpoint
    // reads the graph, not the FAQ, so the graph has to carry the caveat.
    //
    // `termsOfService` is a `Service` property and `WebAPI` is a `Service`, so
    // it applies directly. No rate limit is declared: the figure the pages
    // give is an OUTBOUND one (how fast an instance queries its sources), not
    // a limit on callers, and asserting it here would describe a rule that
    // does not exist.
    termsOfService: new URL(pageUrl(DEFAULT_LANG, "policies")).href,
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "transport",
        value: "Streamable HTTP (JSON-RPC 2.0 over POST)",
      },
      {
        "@type": "PropertyValue",
        name: "authentication",
        // Derived from the headers the server actually requires, not restated:
        // libgen needs none, gitlab needs a Bearer credential.
        value:
          server.requiredHeaders.length === 0
            ? "None"
            : server.requiredHeaders
                .map((header) => `${header.name} header required`)
                .join(", "),
      },
      {
        "@type": "PropertyValue",
        name: "serviceLevelAgreement",
        value:
          "None. A personal service, offered as-is: it may change or be withdrawn without notice.",
      },
    ],
    // The connection card this site publishes for the endpoint (SEP-2127),
    // which until now existed only in a `Link:` header. NOT the catalogue the
    // binary serves at `/.well-known/mcp/server-card.json`: two different
    // documents share that name, and the repo has confused them before.
    // No `@id` on it: nothing references this node, and an `@id` here would
    // read as a dangling reference to the graph-cohesion test, which collects
    // only top-level declarations.
    subjectOf: {
      "@type": "MediaObject",
      name: `${server.name} MCP connection card`,
      contentUrl: `${server.endpoint}/server-card`,
      encodingFormat: "application/mcp-server-card+json",
    },
    provider: ref(PERSON_ID),
    // `provider` says who OPERATES it; `author` who MADE it. Here they are the
    // same person and the visible text already says so ("who is also the author
    // of both servers") — the graph has to tell the same story.
    author: ref(PERSON_ID),
    // The way back to the code: `targetProduct` has no inverse in schema.org,
    // so without this whoever arrives through `mainEntity` never reaches the
    // repository.
    isBasedOn: ref(sourceId(server)),
    // `softwareHelp` used to be a bare `ref()`, pointing at an `@id` nothing
    // defines: the gitlab docs site names its node `…/#webpage`, never the
    // naked URL, so the reference dangled. libgen's happened to resolve — its
    // docs site does define a CollectionPage with the bare `@id` — so the same
    // code behaved differently per server, which is how the 2026-08-22 audit
    // found it. A typed inline node says what the URL is without claiming to
    // define someone else's `@id`; the range is CreativeWork, so a plain URL
    // would not do either.
    softwareHelp: {
      "@type": "WebPage",
      url: server.docsSite ?? server.docs,
      name: `${server.name} documentation`,
    },
    // What a caller has to bring. This is the "can I actually use this?" fact,
    // and until now only /servers.json answered it — the graph did not.
    // The article is derived rather than hardcoded: the only required header
    // today is `Authorization`, and "a Authorization header" is a sentence an
    // assistant would quote verbatim.
    permissions:
      server.requiredHeaders.length > 0
        ? server.requiredHeaders
            .map(
              (h) =>
                `Requires ${/^[AEIOU]/i.test(h.name) ? "an" : "a"} ${h.name} header on every request.`,
            )
            .join(" ")
        : "None. The server is public and takes no credentials.",
    softwareRequirements:
      "An MCP client speaking streamable HTTP (JSON-RPC 2.0 over POST).",
    // The descriptions are bilingual literals, so the node is too.
    inLanguage: ["en", "es"],
    // Listings in MCP directories that describe THIS server (not the repo: the
    // repo is linked through isBasedOn → codeRepository). With none, the
    // undefined disappears on its own at serialization.
    sameAs: server.sameAs,
    // How it is really called: POST with JSON-RPC, not a GET on the URL. A
    // crawler following `url` gets an error (405 on libgen, 401 on gitlab),
    // which is correct by design.
    // Two actions: how to call it, and how to ask whether it is up. The second
    // is the question an agent asks BEFORE the first, and until now only
    // /servers.json answered it — the health URLs were absent from the graph
    // even though both return 200.
    potentialAction: [
      {
        "@type": "Action",
        name: "JSON-RPC 2.0 call over streamable HTTP",
        target: {
          "@type": "EntryPoint",
          urlTemplate: server.endpoint,
          httpMethod: "POST",
          encodingType: "application/json",
          contentType: "application/json, text/event-stream",
        },
      },
      {
        "@type": "CheckAction",
        name: "Health check",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${server.endpoint}/health`,
          httpMethod: "GET",
          contentType: "application/json",
        },
      },
    ],
  };
}

/**
 * A PARTIAL description of a server's endpoint: what it is and where it is,
 * nothing more. For the pages that MENTION it without being its card.
 *
 * It does not redefine the full node. Its four keys come from the SAME
 * `servers.ts` entry as {@link buildApiNode}'s, so they cannot contradict it,
 * and no fact that decides anything — license, tools, actions, dates — travels
 * outside the card.
 *
 * Nor is the bare reference that used to be here enough: the `@id` is
 * `<endpoint>#api` and a GET on that URL answers an error — 405 on libgen, 401
 * on gitlab; correct by design, the endpoint only speaks POST — so someone
 * reading only the home page cannot tell what that entity is even by following
 * the link. It is the same pattern as `softwareHelp` in {@link buildApiNode}:
 * an inline typed node says WHAT a URL is without pretending to define another
 * node's `@id`.
 *
 * It goes NESTED in `mainEntity`, NEVER as a `@graph` entry: there it would be
 * a second top-level node for the same entity, which is exactly what the
 * 22 Aug correction removed.
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns The four keys that identify the endpoint, and no others.
 */
function partialApi(server: McpServer): Record<string, unknown> {
  return {
    "@id": apiId(server),
    "@type": API_TYPES,
    name: server.name,
    url: server.endpoint,
  };
}

/**
 * Builds ONE server's `SoftwareSourceCode` node — the bridge between the
 * endpoint and the repository that produces it, the evidence behind "can I
 * trust this?". It lives on the SAME page as its `WebAPI` (see
 * {@link buildApiNode}): that server's card, never another.
 *
 * This `@id` is not only ours: each repo's documentation site
 * (`https://jmrp.io/docs/<repo>`) is the entity's home and publishes the SAME
 * `@id`. That is why the four facts asserted here — `name`,
 * `programmingLanguage`, `license` and `author` — have been checked one by one
 * against what that site publishes for that `@id`, and are only asserted
 * because they match: when the two graphs merge they cannot contradict each
 * other. The two that vary per server come from {@link SOURCE_FACTS}, which is
 * where the verbatim copy lives.
 *
 * The risk taken, written here so it is not discovered six months from now: if
 * the documentation site changes its `name`, its license or its language, this
 * repo goes out of sync and NO test sees it — the tests only look at what this
 * repo builds, not at what the other one publishes.
 *
 * What is left out — `creator`, `maintainer`, `isPartOf`, `runtimePlatform`,
 * `version`, `dateModified` — stays out for the usual reason: only the
 * documentation site can keep it true, and asserting it from here is signing
 * up for the day it says something else.
 *
 * The one thing this page contributes, and nobody else can, is which hosted
 * endpoint runs that code — through `targetProduct`, towards the `WebAPI` on
 * this very page and, as an external reference without redefining it, towards
 * jmrp.io/projects' canonical `#software` (the same principle as the identity
 * document's `owns`).
 *
 * @param server A server from `src/data/servers.ts`.
 * @returns The node, ready for the `@graph`.
 */
function buildSourceNode(server: McpServer): Record<string, unknown> {
  const facts = SOURCE_FACTS[server.id];
  return {
    "@type": "SoftwareSourceCode",
    "@id": sourceId(server),
    ...(facts && {
      name: facts.name,
      // `programmingLanguage` as plain text and not as a `ComputerLanguage`
      // node with its Wikidata Q-id: the canonical publisher uses a literal,
      // and a node here would add a second, DIFFERENT value for the same
      // property of the same `@id`.
      programmingLanguage: facts.programmingLanguage,
    }),
    codeRepository: server.repo,
    license: MIT_LICENSE,
    // A reference, never their data: the identity document is the single
    // source of truth for who the author is.
    author: ref(PERSON_ID),
    targetProduct: [ref(apiId(server)), ref(`${server.repo}#software`)],
  };
}

/** The page data the graph needs from the layout. */
export interface PageMeta {
  lang: Lang;
  title: string;
  description: string;
  /**
   * Which page this is. Defaults to `"home"` for callers that predate this
   * field (there are none left in `src/`, but the test helpers construct
   * `PageMeta` literals directly).
   */
  page?: PageId;
  /**
   * Server id for a per-server detail page (`/servers/<id>/`).
   *
   * When set, this page IS that server's `WebAPI`/`SoftwareApplication` and
   * `SoftwareSourceCode` nodes' home: `buildSiteGraph` builds them in full
   * here (see `buildApiNode`/`buildSourceNode`) instead of the lightweight
   * `ref()` every other page uses. It also drives the `WebPage`'s
   * `url`/`@id`/translation pair via `serverPageUrl`, because
   * `pageUrl(lang, "servers")` — the fixed path `PAGE_PATHS` knows — is the
   * `/servers/` INDEX's URL, not any one server's; every detail page shares
   * `page: "servers"` (for nav/breadcrumb) but NOT this `@id`.
   */
  serverId?: string;
  /**
   * Action-domain page under a server's card
   * (`/servers/<id>/actions/<domain>/`).
   *
   * Deliberately NOT `serverId`: that prop makes a page the HOME of the
   * server's `WebAPI`/`SoftwareSourceCode` nodes, and those live on the card
   * alone — define-once is the rule the 2026-08-22 audit restored. A domain
   * page merely DESCRIBES a slice of that API, so it gets `partialApi` as its
   * `mainEntity` (the same shape every other mentioning page uses) and its
   * own URL/breadcrumb derived here.
   */
  actionsDomain?: { serverId: string; domain: string };
}

/**
 * Server this page IS the card of — `undefined` for every page except
 * `/servers/<id>/`. Throws rather than silently ignoring a mismatch: a
 * `serverId` that does not match any entry in `servers.ts` is a caller bug (a
 * stale id, a typo), and rendering the page as if it were a normal one would
 * hide it behind a graph that quietly stopped matching the URL.
 *
 * @param serverId `PageMeta.serverId` — unset for every page but a server
 *   card.
 * @returns The matching server, or `undefined` when `serverId` is unset.
 */
function resolveTargetServer(
  serverId: string | undefined,
): McpServer | undefined {
  if (!serverId) return undefined;
  const server = servers.find((candidate) => candidate.id === serverId);
  if (!server) {
    throw new Error(
      `[jsonld] serverId "${serverId}" has no entry in servers.ts`,
    );
  }
  return server;
}

/**
 * This page's URL and its translation's.
 *
 * `pageUrl(lang, page)` only knows the FIXED path per `PageId` — for
 * `page: "servers"` that is the `/servers/` INDEX, not any one server's
 * card. `serverPageUrl` is the per-server equivalent every detail page needs
 * instead. See the `serverId` doc on `PageMeta`.
 *
 * @param lang This page's language.
 * @param page This page's `PageId`, used for the fixed-path case.
 * @param targetServer The server this page is the card of, from
 *   {@link resolveTargetServer}.
 * @returns `url` for this page and `otherUrl` for its translation.
 */
function resolvePageUrls(
  lang: Lang,
  page: PageId,
  targetServer: McpServer | undefined,
  actionsDomain?: PageMeta["actionsDomain"],
): { url: string; otherUrl: string } {
  const otherLang: Lang = lang === "en" ? "es" : "en";
  if (actionsDomain) {
    return {
      url: actionsDomainPageUrl(
        lang,
        actionsDomain.serverId,
        actionsDomain.domain,
      ),
      otherUrl: actionsDomainPageUrl(
        otherLang,
        actionsDomain.serverId,
        actionsDomain.domain,
      ),
    };
  }
  if (targetServer) {
    return {
      url: serverPageUrl(lang, targetServer.id),
      otherUrl: serverPageUrl(otherLang, targetServer.id),
    };
  }
  return { url: pageUrl(lang, page), otherUrl: pageUrl(otherLang, page) };
}

/**
 * What THIS page's `mainEntity` should carry.
 *
 * schema.org defines `mainEntity` as "the primary entity described in this
 * page", so it can only point at server APIs on pages that actually describe
 * one. A server card's primary entity is SOLELY its own server, never the
 * other one. The home page and `/servers/` describe every server, so they
 * keep the full list. Every other page — `/inspector/`, `/internals/`,
 * `/policies/` — describes no server at all, so `mainEntity` is omitted
 * rather than claim a false subject: those pages used to inherit `apiRefs`
 * wholesale and claimed both server APIs as their primary entity despite
 * rendering no server description.
 *
 * The SHAPE differs by page, and deliberately so. A server's own card gets a
 * BARE reference, because the full node sits in this very document: a partial
 * description there would only repeat two of its keys. The pages that merely
 * mention the servers get {@link partialApi} instead — a bare `@id` there
 * names a node that lives on another page and answers an error when dereferenced,
 * so nothing on the page says what the entity even is.
 *
 * @param page This page's `PageId`.
 * @param targetServer The server this page is the card of, from
 *   {@link resolveTargetServer}.
 * @returns The nodes for `mainEntity`, or `undefined` to omit the property.
 */
function selectMainEntity(
  page: PageId,
  targetServer: McpServer | undefined,
  articleId: string,
  actionsDomain?: PageMeta["actionsDomain"],
): Record<string, unknown>[] | undefined {
  if (targetServer) return [ref(apiId(targetServer))];
  // A prose page describes no server, so the slot is free for the article the
  // page IS — see `buildArticleNode`. Decided here and not at the assembly
  // site so there is one answer to "what is this page's main entity".
  if (PROSE_PAGES.has(page)) return [ref(articleId)];
  if (actionsDomain) {
    // A domain page describes a PORTION of a single server: that server's
    // partial description, in the same shape the other pages that mention it
    // without defining it use.
    const server = servers.find((s) => s.id === actionsDomain.serverId);
    return server ? [partialApi(server)] : undefined;
  }
  const describesEveryServer = page === "home" || page === "servers";
  return describesEveryServer
    ? servers.map((server) => partialApi(server))
    : undefined;
}

/**
 * The visible label of every page, in one language.
 *
 * These are the SAME keys (`navHome`…`navServers`) the header navigation
 * renders from, on purpose: the breadcrumb and the menu have to call each page
 * the same thing, or the graph describes a site that is not the one on screen.
 * The `Record<PageId, string>` type means a sixth page cannot be added without
 * a label — the same guarantee `PAGE_PATHS` already gives for routes.
 *
 * `Base.astro` builds this very map for its `<nav>`. Duplicated knowingly:
 * hoisting it to `seo.ts` (next to `PAGE_PATHS`, which is where it belongs)
 * and having both consume it edits two files this change does not own. Until
 * then the drift is bounded — both halves read the same i18n keys, and neither
 * compiles with a page missing.
 *
 * @param lang Language of the page being built.
 * @returns One label per `PageId`.
 */
function pageLabels(lang: Lang): Record<PageId, string> {
  const t = ui[lang];
  return {
    home: t.navHome,
    inspector: t.navInspector,
    internals: t.navInternals,
    license: t.navLicense,
    policies: t.navPolicies,
    servers: t.navServers,
  };
}

/**
 * The path from the site root down to THIS page, one step per level.
 *
 * Three levels at most, because the site really is that flat: `/inspector/`,
 * `/internals/`, `/policies/` and `/servers/` all hang off the root, and only
 * a server card sits one level deeper (under the `/servers/` index).
 *
 * The `/es/` prefix needs no special case: every step is built with
 * `pageUrl`/`serverPageUrl`, which already carry it, so a Spanish crumb
 * cannot end up pointing at the English page — the failure a hand-built
 * `${SITE_ORIGIN}/servers/` would make invisible.
 *
 * The server's name is NOT translated: it is data, like the endpoints and the
 * MCP method names (see the header of `src/i18n/ui/servers-page.ts` and of
 * `src/data/servers.ts`). The page LABELS are, and they come from
 * {@link pageLabels} — the same i18n keys the visible navigation renders from,
 * so the crumb and the nav cannot call the same page two different things.
 *
 * The home page gets no crumb at all — it is the root, there is no path to
 * describe — by the same rule that keeps `FAQPage` and `speakable` on the one
 * page whose content backs them.
 *
 * @param lang This page's language.
 * @param page This page's `PageId`.
 * @param targetServer The server this page is the card of, from
 *   {@link resolveTargetServer}.
 * @returns The steps root-first, or `undefined` on the home page.
 */
function breadcrumbSteps(
  lang: Lang,
  page: PageId,
  targetServer: McpServer | undefined,
  actionsDomain?: PageMeta["actionsDomain"],
): { name: string; url: string }[] | undefined {
  if (page === "home") return undefined;
  const labels = pageLabels(lang);
  if (actionsDomain) {
    // Four real levels: root → index → card → domain. The domain's name is
    // manifest DATA (like the ids), so it is not translated.
    return [
      { name: labels.home, url: pageUrl(lang, "home") },
      { name: labels.servers, url: pageUrl(lang, "servers") },
      {
        name: actionsDomain.serverId,
        url: serverPageUrl(lang, actionsDomain.serverId),
      },
      {
        name: actionsDomain.domain,
        url: actionsDomainPageUrl(
          lang,
          actionsDomain.serverId,
          actionsDomain.domain,
        ),
      },
    ];
  }
  const steps = [
    { name: labels.home, url: pageUrl(lang, "home") },
    { name: labels[page], url: pageUrl(lang, page) },
  ];
  if (targetServer) {
    steps.push({
      name: targetServer.name,
      url: serverPageUrl(lang, targetServer.id),
    });
  }
  return steps;
}

/**
 * Builds a page's complete JSON-LD graph.
 *
 * @param meta Language, title, description, page and — for a server card —
 *   the `serverId` saying which one is being rendered.
 * @returns An object ready to serialize with {@link safeJsonLd}.
 */
export async function buildSiteGraph(
  meta: PageMeta,
): Promise<Record<string, unknown>> {
  const {
    lang,
    title,
    description,
    page = "home",
    serverId,
    actionsDomain,
  } = meta;

  const targetServer = resolveTargetServer(serverId);
  const { url, otherUrl } = resolvePageUrls(
    lang,
    page,
    targetServer,
    actionsDomain,
  );

  // The FAQ (and its speakable pointer) describes the notice cards, and those
  // only render on the home page — see HomePage.astro / ServerCard. Emitting
  // a FAQPage on /inspector/ or /policies/ would be structured data with no
  // matching content on the page, which is the defect this task fixes.
  const isHome = page === "home";

  // The full WebAPI+SoftwareApplication (and matching SoftwareSourceCode)
  // node: built ONLY when this page IS that server's own card — see
  // `buildApiNode`/`buildSourceNode`'s doc comments for why. Every other page
  // gets an empty array here and reaches the same entity through `apiRefs`
  // below instead, which is a bare `{"@id": …}` and never redeclares the
  // node's data.
  const apis = targetServer ? [buildApiNode(targetServer)] : [];
  const sources = targetServer ? [buildSourceNode(targetServer)] : [];

  // References to EVERY server's WebAPI node, regardless of whether this
  // page defines one — this is what the FAQ's `about` (home only) points
  // through. `mainEntity` no longer uses it: it carries a partial description
  // instead of a bare ref on the pages that only mention the servers (see
  // `selectMainEntity`/`partialApi`).
  // `provider` closes the reciprocal pair with the identity document's `owns`,
  // which already declares these two repos' `#software`; `sameAs` leads to the
  // repository, which is the subject of those nodes.
  const apiRefs = servers.map((server) => ref(apiId(server)));
  const mainEntity = selectMainEntity(
    page,
    targetServer,
    `${url}#article`,
    actionsDomain,
  );

  // The breadcrumb, as its own node the `WebPage` points at by `@id` (like the
  // `FAQPage`). Built BEFORE `webpage` because that one references it.
  const breadcrumbId = `${url}#breadcrumb`;
  const steps = breadcrumbSteps(lang, page, targetServer, actionsDomain);
  const breadcrumb = steps
    ? {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: steps.map((step, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: step.name,
          // `item` as a NODE and not as a string: schema.org gives it no
          // `"@type": "@id"` coercion in its context, so a bare URL would
          // expand to a text literal and the step would link to nothing — the
          // same defect `about` carried until today. And without a fragment
          // (`…/servers/`, not `…#webpage`), because it is the URL a search
          // engine paints in the result's breadcrumb.
          item: { "@id": step.url },
        })),
      }
    : null;

  // Loaded here and not just before the graph is assembled: the card's credit
  // line below comes out of this node. The author's name is NOT restated in
  // this file — see the rule at the top — so if the identity document ever
  // stops carrying one, the credit keys drop out instead of printing a guess.
  const person = await loadPersonNode();
  const authorName = typeof person.name === "string" ? person.name : null;

  const website = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_ORIGIN}/`,
    name: SITE_NAME,
    description: localized({ en: ui.en.lede, es: ui.es.lede }),
    inLanguage: LANGS,
    publisher: ref(PERSON_ID),
    // The documents this site publishes for programs. They were reachable
    // only through `<link rel="alternate">` and a `Link:` header, so a
    // consumer that reads JSON-LD and nothing else could not find them —
    // which is most of the audience they were written for.
    subjectOf: [
      {
        "@type": "DataDownload",
        name: "llms.txt index",
        contentUrl: `${SITE_ORIGIN}/llms.txt`,
        encodingFormat: "text/plain",
      },
      {
        "@type": "DataDownload",
        name: "llms.txt, long form",
        contentUrl: `${SITE_ORIGIN}/llms-full.txt`,
        encodingFormat: "text/plain",
      },
      {
        "@type": "DataDownload",
        name: "MCP server index",
        contentUrl: `${SITE_ORIGIN}/servers.json`,
        encodingFormat: "application/json",
      },
      {
        "@type": "DataDownload",
        name: "AI catalog",
        contentUrl: `${SITE_ORIGIN}/.well-known/ai-catalog.json`,
        encodingFormat: "application/json",
      },
      {
        "@type": "DataDownload",
        name: "API catalog (RFC 9727)",
        contentUrl: `${SITE_ORIGIN}/.well-known/api-catalog`,
        encodingFormat: "application/linkset+json",
      },
    ],
  };

  const articleId = `${url}#article`;

  // This page's own dates. Resolved from `url` and not from `page`, so a
  // server card and an actions domain — which share a `PageId` with their
  // index — each get the dates of the sources they actually render.
  const webpageDates = datesOf(new URL(url).pathname);

  const webpage = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: lang,
    isPartOf: ref(WEBSITE_ID),
    // The FAQ is part of this page — but only for the home page, which is the
    // only one with notice cards to describe. Without this the link ran one
    // way only: #faq declared its `isPartOf`, but nothing led from the page
    // down to it.
    ...(isHome && { hasPart: ref(`${url}#faq`) }),
    // A separate node linked by `@id`, like the `FAQPage`: the `WebPage` says
    // the breadcrumb EXISTS and the node says which steps it has. Absent on
    // the home page, which is the root (see `breadcrumbSteps`).
    ...(breadcrumb && { breadcrumb: ref(breadcrumbId) }),
    // hreflang already says these two pages are translations of each other;
    // the graph did not. Same pairing jmrp.io/about/#profile already emits.
    // The other language's `#webpage` for THIS SAME page, not the home
    // page's — each page pairs with its own translation. `otherUrl` already
    // resolves through `serverPageUrl` for a server card (see above), so a
    // card pairs with ITS OWN translation, never the `/servers/` index's.
    ...(lang === "en"
      ? { workTranslation: ref(`${otherUrl}#webpage`) }
      : { translationOfWork: ref(`${otherUrl}#webpage`) }),
    // The OG cards exist and return 200, and the page node carried no image
    // at all.
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: ogImageUrl(lang),
      // Where the bytes are, as distinct from what `url` identifies. Google's
      // image metadata documentation asks for `contentUrl` specifically, and a
      // node carrying only `url` does not qualify for the feature at all —
      // which would have made the two license fields below inert even once
      // they existed. The same address here: the card is a PNG with no landing
      // page of its own.
      contentUrl: ogImageUrl(lang),
      // The card IS this page's image, not decoration beside it — the
      // distinction Google draws when picking a thumbnail.
      representativeOfPage: true,
      // Attribution by reference to the canonical entity rather than a second
      // Person node, following the rule at the top of this file. `creator`
      // says who made it, `copyrightHolder` who holds the right the license
      // grants from — the one thing someone reusing it has to know to judge
      // whether the grant was the owner's to make — and `creditText` how to
      // name them.
      creator: ref(PERSON_ID),
      copyrightHolder: ref(PERSON_ID),
      ...(authorName && {
        creditText: authorName,
        copyrightNotice: `© ${authorName}`,
      }),
      // The two fields Search Console reports as missing on every page here:
      // `license` states the terms, `acquireLicensePage` says where to ask
      // about anything they do not grant. Google requires the two to be
      // distinct URLs, so one is the license itself and the other the
      // Permission section of /license/.
      //
      // The cards are drawn at build time from this site's own headings and
      // server data (`src/pages/og-[lang].png.ts`), with nothing in them taken
      // from anywhere else, so the CC BY 4.0 that covers the text covers them
      // too — which /license/ now says in prose, under `Images`. A `license`
      // asserted here that no page granted would be a claim with nothing
      // behind it.
      license: CC_BY_4_0,
      acquireLicensePage: `${pageUrl(lang, "license")}#permission-h`,
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
    },
    author: ref(PERSON_ID),
    publisher: ref(PERSON_ID),
    ...webpageDates,
    // `mainEntity` and not `about`: these servers are not something the page
    // talks about, they are its subject. `about` said exactly the same thing
    // with the weaker claim, so it was redundant: schema.org already defines
    // mainEntity as "the primary entity described in this page", which is the
    // case here.
    // Never the FULL node: that is only declared on its server's card. Here it
    // is a PARTIAL four-key description on the pages that merely mention it,
    // and a bare reference on its own card, where the whole node is in plain
    // sight (see `selectMainEntity`).
    // Omitted entirely on pages that describe no server at all — emitting it
    // there claimed a primary entity the page never renders.
    ...(mainEntity && { mainEntity }),
    // The notices are the page's concise, self-contained passages — token
    // policy, legal stance, limits — and their DOM `id`s already exist
    // (ServerCard adds them so they can be linked). `speakable` marks them as
    // the passages an assistant may read aloud or quote. They only exist on
    // the home page, so `speakable` does too.
    //
    // These ids now sit on the <details>, which wraps the question in its
    // <summary> together with the answer. They used to sit on the inner notice
    // div — the answer alone — so a read-aloud produced "libgen is a client of
    // third-party public indexes…" with no question attached to it.
    ...(isHome && {
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: servers.flatMap((server) =>
          server.notices.map((notice) => `#${server.id}-${notice.kind}`),
        ),
      },
    }),
  };

  // The card notices are literally questions with their answer (token policy,
  // legal stance, limits): marking them as a FAQPage formalizes that structure
  // for whoever extracts answers. Google no longer paints FAQ rich results for
  // sites like this one (restricted in 2023); the audience is assistants, not
  // the SERP. It comes from `servers.ts`, the same source that renders the
  // notices: it cannot drift from the text.
  // `url` and `name`: FAQPage is a subclass of WebPage, so without them the
  // graph described the same document as two WebPages, one of which could not
  // be tied to a URL at all. The `hasPart` on the WebPage node below is the
  // matching inverse — the FAQ used to be reachable upward from itself but not
  // downward from the page.
  // Only built for the home page: it is the only page with notice cards to
  // describe, and the `isHome` checks on `webpage` above already keep it
  // undiscoverable (no `hasPart`) from every other page's node.
  const faq = isHome
    ? {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        name: title,
        inLanguage: lang,
        isPartOf: ref(`${url}#webpage`),
        // The FAQ only ever renders on the home page (see `isHome` above), so
        // this is always the full list, both servers. Bare refs on purpose:
        // the home page's `mainEntity` already carries each endpoint's partial
        // description (see `selectMainEntity`), so these resolve to something
        // typed WITHIN this same document.
        about: apiRefs,
        mainEntity: servers.flatMap((server) =>
          server.notices.map((notice) => ({
            "@type": "Question",
            name: notice.title[lang],
            acceptedAnswer: {
              "@type": "Answer",
              text: noticeAnswer(notice, lang),
            },
          })),
        ),
      }
    : null;

  const article = buildArticleNode({
    page,
    lang,
    url,
    articleId,
    description,
    dates: webpageDates,
    apiPartials: servers.map((server) => partialApi(server)),
  });

  const graph = [
    website,
    webpage,
    ...(article ? [article] : []),
    ...(breadcrumb ? [breadcrumb] : []),
    ...(faq ? [faq] : []),
    ...apis,
    ...sources,
    ...(person ? [person] : []),
  ];

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

/**
 * A notice's answer as plain text for `acceptedAnswer`.
 *
 * Paragraphs and bullets in order — the bullets are complete sentences — and
 * without the markup's backticks: in a JSON-LD text literal they would be
 * noise.
 *
 * @param notice A notice from `src/data/servers.ts`.
 * @param lang The page's language.
 * @returns The answer's text, in one piece.
 */
function noticeAnswer(notice: McpNotice, lang: Lang): string {
  const parts = [...notice.body, ...(notice.bullets ?? [])];
  return parts
    .map((part) => part[lang])
    .join(" ")
    .replaceAll("`", "");
}

/**
 * Serializes an object for embedding in `<script type="application/ld+json">`.
 *
 * Escapes `<`, `>` and `&` so no value can close the tag or open another, plus
 * the U+2028/U+2029 line separators, which are valid in JSON but break parsing
 * in some consumers. Every sequence emitted is a legal `\uXXXX` escape, so the
 * result is still valid JSON and `JSON.parse` recovers it intact.
 *
 * @param data The object to serialize.
 * @returns A JSON string safe to insert into the HTML as-is.
 */
export function safeJsonLd(data: unknown): string {
  const json = JSON.stringify(data);
  if (!json) return "null";
  return json
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll(">", String.raw`\u003e`)
    .replaceAll("&", String.raw`\u0026`)
    .replaceAll("\u{2028}", String.raw`\u2028`)
    .replaceAll("\u{2029}", String.raw`\u2029`);
}
