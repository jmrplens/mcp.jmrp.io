import type { Locator, Page } from "@playwright/test";

import { type Lang, ui } from "../../src/i18n/ui";

/**
 * Locators shared by the e2e suite.
 *
 * They exist so the tests point at the INFORMATION and not at the markup: the
 * page's design has been redone once (the "Required headers: X" line became a
 * badge plus a `<dl>`) and will change again. What cannot change without it
 * being a content defect is what each card says and which controls the
 * inspector offers.
 *
 * This file is NOT a spec: Playwright only collects `*.spec.ts`.
 */

/**
 * A server's card, identified by its heading.
 *
 * The whole card is returned so a fact can be asserted to be on ITS OWN
 * server. Searching for loose text on the page does not tell whether
 * "Authorization" shows up on gitlab's card or on libgen's, and that confusion
 * is exactly the mistake these tests have to catch.
 *
 * @param page The page under test.
 * @param name The server's name, exactly as it appears in `src/data/servers.ts`.
 * @returns That card's `<article>`.
 */
export function serverCard(page: Page, name: string): Locator {
  return page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

/**
 * The inspector island.
 *
 * Scoping to the island is not cosmetic: the servers section is a region with
 * an accessible name ("Servers" / "Servidores"), so a page-level `getByLabel`
 * catches both the region and the `<select>` and blows up under strict mode.
 *
 * @param page The page under test.
 * @returns The island's container.
 */
export function inspector(page: Page): Locator {
  return page.getByTestId("inspector");
}

/**
 * The island's server dropdown.
 *
 * The label comes from `ui.ts` and not from a literal: when it went from
 * "Server" to "Endpoint" — to stop colliding with the "Servers" eyebrow — nine
 * tests went red at once for having it written out by hand.
 *
 * @param page The page under test.
 * @param lang The page's language.
 * @returns The server `<select>`.
 */
export function serverSelect(page: Page, lang: Lang = "en"): Locator {
  return inspector(page).getByLabel(ui[lang].insp.server);
}

/**
 * The response the stub answers a method with.
 *
 * `json` is wrapped in SSE (`data: {…}`), which is how these servers really
 * answer; `body` goes through as it is, so a transport error's bare text can be
 * returned. `hang` never answers: it is the only way to test the cancel
 * button.
 */
export type McpStub = {
  status?: number;
  json?: unknown;
  body?: string;
  hang?: boolean;
};

/** A request that left the browser towards an MCP, already captured. */
export type SentRequest = {
  url: string;
  headers: Record<string, string>;
  body: { method?: string; params?: unknown };
};

// These are cross-origin requests (mcp.jmrp.io from localhost), so without
// these headers the browser drops the response and the island only sees a
// TypeError.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

/**
 * Intercepts the MCP endpoints and answers according to the method asked for.
 *
 * The interface tests must NOT depend on what the production server answers:
 * what is checked here is that an `isError: true` renders differently from a
 * success, and for that each case has to be reachable on demand.
 *
 * @param page The page under test.
 * @param reply What to return for each JSON-RPC method.
 * @returns The array the outgoing requests are recorded into.
 */
export async function stubMcp(
  page: Page,
  reply: (method: string) => McpStub,
): Promise<SentRequest[]> {
  const sent: SentRequest[] = [];
  await page.route(/mcp\.jmrp\.io\/(gitlab|libgen)$/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const body = (request.postDataJSON() ?? {}) as SentRequest["body"];
    sent.push({ url: request.url(), headers: request.headers(), body });

    const stub = reply(body.method ?? "");
    if (stub.hang) return;
    await route.fulfill({
      status: stub.status ?? 200,
      headers: { ...CORS, "content-type": "text/event-stream" },
      body: stub.body ?? `data: ${JSON.stringify(stub.json ?? {})}\n\n`,
    });
  });
  return sent;
}

/**
 * A sample catalog for `tools/list`.
 *
 * It is libgen's, trimmed, with `search`'s real `inputSchema`: a single
 * required property (`query`) and an optional one. That shape is the one that
 * trips up anyone guessing the arguments, and therefore the one to test.
 */
export const TOOLS_LIST = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    tools: [
      {
        name: "search",
        description: "Search Library Genesis",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", description: "What to look for" },
            results_per_page: { type: "integer", description: "Page size" },
          },
        },
      },
      { name: "download", inputSchema: { type: "object" } },
    ],
  },
};

/**
 * The button that loads a catalog (`tools/list`, `prompts/list`…).
 *
 * By `data-testid` and not by label: the redesign changed "tools/list" to
 * "Load tools" and took six tests down with it.
 *
 * @param page The page under test.
 * @param kind The catalog to load.
 * @returns The button.
 */
export function loadButton(
  page: Page,
  kind: "tools" | "prompts" | "resources" = "tools",
): Locator {
  return page.getByTestId(`load-${kind}`);
}

/**
 * The button that runs whatever is selected.
 *
 * @param page The page under test.
 * @param lang The page's language.
 * @returns The run button.
 */
export function runButton(page: Page, lang: Lang = "en"): Locator {
  return inspector(page).getByRole("button", {
    name: ui[lang].insp.runTool,
    exact: true,
  });
}

/**
 * Walks the inspector's flow until a tool is ready to invoke: load the catalog,
 * pick it and wait for its form.
 *
 * In a helper because the redesign changed that path — the tool's name used to
 * be typed by hand — and the flow appears in half a dozen tests.
 *
 * @param page The page under test.
 * @param name The tool's name.
 */
export async function pickTool(page: Page, name: string): Promise<void> {
  await loadButton(page, "tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await picker.waitFor({ state: "visible", timeout: 40_000 });
  await picker.selectOption(name);
  await page.getByTestId("args-form").waitFor({ state: "visible" });
}

/**
 * Switches the form to JSON mode and writes the raw arguments.
 *
 * @param page The page under test.
 * @param json The arguments as JSON text.
 * @param lang The page's language.
 */
export async function fillRawArgs(
  page: Page,
  json: string,
  lang: Lang = "en",
): Promise<void> {
  const mcp = inspector(page);
  await mcp.getByRole("button", { name: ui[lang].insp.jsonMode }).click();
  await mcp.getByLabel(ui[lang].insp.argsJson).fill(json);
}

/**
 * The catalog's tools dropdown.
 *
 * Scoped to the catalog and not by label: the "Tools" tab is a `tabpanel` with
 * an accessible name, so an island-level `getByLabel("Tool")` resolves to two
 * elements and blows up under strict mode.
 *
 * @param page The page under test.
 * @returns The tools `<select>`.
 */
export function toolSelect(page: Page): Locator {
  return page.getByTestId("catalog-tools").locator("select");
}
