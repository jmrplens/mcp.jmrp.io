import { expect, type Page, test } from "@playwright/test";

import {
  inspector,
  loadButton,
  pickTool,
  runButton,
  serverSelect,
  stubMcp as stubMcpByMethod,
  TOOLS_LIST,
} from "./helpers";

// A fake token: if it ever shows up in storage, cookies or the URL, the test
// fails. It does not need to be valid, because these tests never call the
// server.
const TOKEN = "glpat-test-secret";

/**
 * A request the browser tried to send to an MCP, already captured. `headers`
 * arrives with lowercase names (that is how Playwright gives them).
 */
type Sent = { url: string; headers: Record<string, string>; body: unknown };

// The response is served from the test itself, so these tests do NOT need
// Internet access. Since they are cross-origin requests (mcp.jmrp.io from
// localhost), the CORS headers have to be returned or the browser drops the
// response and the inspector would only see a TypeError.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

/** The response of a tool that works. */
const TOOL_OK = {
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: "1 result" }] },
};

const SSE_BODY = 'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n';

/**
 * Intercepts the MCP endpoints and returns the array the requests are recorded
 * into. It is what makes it possible to check WHAT leaves the browser: headers
 * and body, which is exactly the wiring this task builds.
 */
async function stubMcp(page: Page): Promise<Sent[]> {
  const sent: Sent[] = [];
  await page.route(/mcp\.jmrp\.io\/(gitlab|libgen)$/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    sent.push({
      url: request.url(),
      headers: request.headers(),
      body: request.postDataJSON(),
    });
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "text/event-stream" },
      body: SSE_BODY,
    });
  });
  return sent;
}

test("the token field is a password field and is not persisted", async ({
  page,
}) => {
  await page.goto("/inspector/");
  // Scoped to the island: the servers section is a region named "Servers", so
  // a page-level getByLabel is ambiguous.
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  const field = mcp.getByLabel("Authorization");
  await expect(field).toHaveAttribute("type", "password");
  await expect(field).toHaveAttribute("autocomplete", "off");

  await field.fill(TOKEN);
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(stored).not.toContain(TOKEN);

  // Neither cookies nor the query string: those are the other two ways a
  // secret outlives the tab or ends up in a proxy's logs.
  const cookies = JSON.stringify(await page.context().cookies());
  expect(cookies).not.toContain(TOKEN);
  expect(page.url()).not.toContain(TOKEN);

  await page.reload();
  await serverSelect(page).selectOption("gitlab");
  await expect(mcp.getByLabel("Authorization")).toHaveValue("");
});

test("gitlab exposes its optional header and libgen asks for nothing", async ({
  page,
}) => {
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  // gitlab no longer declares any optional header: since --auth-mode=oauth the
  // instance is pinned on the server and `GITLAB-URL` stopped being honoured,
  // so the form must not keep offering it.
  await expect(mcp.getByLabel("GITLAB-URL")).toHaveCount(0);

  // libgen declares no headers: asking for credentials would be lying to the visitor.
  await serverSelect(page).selectOption("libgen");
  await expect(mcp.getByLabel("Authorization")).toHaveCount(0);
});

test("the visitor's token travels as Authorization: Bearer", async ({
  page,
}) => {
  const sent = await stubMcp(page);
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  await mcp.getByLabel("Authorization").fill(TOKEN);
  await loadButton(page).click();

  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].url).toContain("/gitlab");
  // The scheme is composed by the inspector, not by the visitor: what gets
  // typed is the bare token and what goes over the wire carries `Bearer ` in
  // front. It is exactly the half that would break silently if someone removed
  // `valuePrefix` from the server's entry.
  expect(sent[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
});

test("the token does not leak to the server that does not declare it", async ({
  page,
}) => {
  const sent = await stubMcp(page);
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  await mcp.getByLabel("Authorization").fill(TOKEN);

  // Switching servers without reloading: the typed value is still in memory,
  // and this is why the state's key carries the server's id in front. Without
  // that, gitlab's secret would go out towards libgen.
  await serverSelect(page).selectOption("libgen");
  await loadButton(page).click();

  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].url).toContain("/libgen");
  expect(sent[0].headers.authorization).toBeUndefined();
  expect(JSON.stringify(sent[0].headers)).not.toContain(TOKEN);
});

test("the form's arguments travel with their type, not as text", async ({
  page,
}) => {
  const sent = await stubMcpByMethod(page, (method: string) =>
    method === "tools/call" ? { json: TOOL_OK } : { json: TOOLS_LIST },
  );
  await page.goto("/inspector/");

  await pickTool(page, "search");
  // Typing happens in the form's fields, not in a JSON you have to know by
  // heart: that is what the redesign came to fix.
  await page
    .getByTestId("args-form")
    .locator("input, textarea")
    .first()
    .fill("x");
  await runButton(page).click();

  const calls = () => sent.filter((r) => r.body.method === "tools/call");
  await expect.poll(() => calls().length).toBe(1);
  // `query` goes out as a string inside an object: the form converts, it does
  // not concatenate.
  expect(calls()[0].body).toMatchObject({
    method: "tools/call",
    params: { name: "search", arguments: { query: "x" } },
  });
  await expect(page.getByTestId("inspector-output")).toContainText("result");
});
