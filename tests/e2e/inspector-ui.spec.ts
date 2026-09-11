import { expect, test } from "@playwright/test";

import {
  inspector,
  loadButton,
  pickTool,
  runButton,
  serverSelect,
  stubMcp,
  TOOLS_LIST,
  toolSelect,
} from "./helpers";

/**
 * What turns a JSON dump into a usable inspector: picking the tool from a list,
 * seeing which arguments it accepts, and telling a failure from a success.
 *
 * Every response is stubbed on purpose. These tests do not check that the MCPs
 * work — `inspector.spec.ts` does that against production — but that the
 * interface renders each case differently, and there are cases (an
 * `isError: true`, a 400, a request that never comes back) that cannot be
 * provoked at will against the real server.
 */

/** A `tools/call` that fails INSIDE the tool: HTTP 200 and the shape of a `result`. */
const TOOL_ERROR = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    content: [{ type: "text", text: "query is required" }],
    isError: true,
  },
};

const TOOL_OK = {
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: "1 result" }] },
};

const status = (page: Parameters<typeof inspector>[0]) =>
  page.getByTestId("inspector-status");

test("after tools/list the tool is picked from a list, not typed", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  const mcp = inspector(page);

  // Before loading there is no catalog and no way to choose: only the invitation.
  await expect(toolSelect(page)).toHaveCount(0);
  await expect(mcp).toContainText("No tools loaded yet");

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");

  const tool = toolSelect(page);
  await expect(tool).toHaveRole("combobox");
  // The names come from the server, not from a list written into the site.
  await expect(tool.locator("option")).toHaveText([
    /pick a tool/,
    "search",
    "download",
  ]);
});

test("picking a tool shows its inputSchema and pre-fills what is required", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");

  await toolSelect(page).selectOption("search");

  // The form replaced the raw JSON: each property is a field, with its
  // description and marked when it is required. Sending `{}` gave "query is
  // required" and inventing a property gave "unexpected additional
  // properties"; both really happened during the audit.
  const form = page.getByTestId("args-form");
  await expect(form).toBeVisible();
  await expect(form).toContainText("query");
  await expect(form).toContainText("What to look for");
  // The optional ones too, which is what stops people over-guessing.
  await expect(form).toContainText("results_per_page");
  // The tool's description travels with the form.
  await expect(mcp).toContainText("Search Library Genesis");
});

test("switching servers does not keep offering the previous one's tools", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  await loadButton(page).click();
  await expect(toolSelect(page)).toHaveRole("combobox");

  await serverSelect(page).selectOption("gitlab");
  // Offering the previous server's tools would be worse than offering nothing:
  // the dropdown would give names this other one does not implement.
  await expect(toolSelect(page)).toHaveCount(0);
});

test("a success and an isError:true do NOT look the same", async ({ page }) => {
  await stubMcp(page, (method) => ({
    json: method === "tools/call" ? TOOL_OK : TOOLS_LIST,
  }));
  await page.goto("/inspector/");
  const out = page.getByTestId("inspector-output");

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");
  await toolSelect(page).selectOption("search");
  await runButton(page).click();

  await expect(status(page)).toContainText("OK");
  await expect(out).not.toHaveClass(/is-error/);
});

test("a tools/call with isError:true renders as a failure even though it is HTTP 200", async ({
  page,
}) => {
  await stubMcp(page, (method) => ({
    // 200 on purpose: this is THE case that slipped through as a success.
    status: 200,
    json: method === "tools/call" ? TOOL_ERROR : TOOLS_LIST,
  }));
  await page.goto("/inspector/");

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");
  await toolSelect(page).selectOption("search");
  await runButton(page).click();

  await expect(status(page)).toContainText("tool error");
  await expect(status(page)).toContainText("query is required");
  await expect(page.getByTestId("inspector-output")).toHaveClass(/is-error/);
});

test("a transport error states its HTTP code", async ({ page }) => {
  await stubMcp(page, () => ({ status: 400, body: "no server available" }));
  await page.goto("/inspector/");
  await loadButton(page).click();

  await expect(status(page)).toContainText("transport error");
  await expect(status(page)).toContainText("400");
  await expect(page.getByTestId("inspector-output")).toHaveClass(/is-error/);
});

test("a JSON-RPC error carries its own code, not the HTTP one", async ({
  page,
}) => {
  await stubMcp(page, () => ({
    json: {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32_602, message: "unexpected additional properties" },
    },
  }));
  await page.goto("/inspector/");
  await loadButton(page).click();

  await expect(status(page)).toContainText("JSON-RPC error");
  await expect(status(page)).toContainText("-32602");
  await expect(status(page)).toContainText("unexpected additional properties");
});

test("the status line gives the method, the code, the time and the size", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  await loadButton(page).click();

  const line = status(page);
  await expect(line).toContainText("tools/list");
  await expect(line).toContainText("200");
  // A time (ms or s) and a size (B or kB): the two figures that were missing.
  await expect(line).toContainText(/\d+(\.\d+)? (ms|s)/);
  await expect(line).toContainText(/\d+(\.\d+)? (B|kB)/);
});

test("the screen reader hears the summary, not the whole dump", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  const out = page.getByTestId("inspector-output");

  // The aria-live used to hang off the <pre>: 43,260 characters announced in one go.
  await expect(out).toHaveAttribute("aria-live", "off");
  await expect(out).toHaveAttribute("tabindex", "0");
  await expect(out).toHaveRole("region");
  await expect(status(page)).toHaveRole("status");
});

test("the response can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");

  await mcp.getByRole("button", { name: "Copy" }).click();
  await expect(status(page)).toContainText("Response copied");

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('"search"');
});

test("an in-flight request can be cancelled", async ({ page }) => {
  await stubMcp(page, () => ({ hang: true }));
  await page.goto("/inspector/");
  await loadButton(page).click();

  const cancel = page.getByTestId("inspector-cancel");
  await expect(cancel).toBeVisible();
  await expect(status(page)).toContainText("running");

  await cancel.click();
  await expect(status(page)).toContainText("Cancelled");
  await expect(cancel).toBeHidden();
  // And something can be asked for again: cancelling does not leave the island useless.
  await expect(loadButton(page)).toBeEnabled();
});

test("an empty required header blocks sending and says why", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");

  // Without this the visitor got a 400 carrying the upstream's text, "no
  // server available", which reads as "the server is down".
  await expect(page.getByTestId("inspector-missing-header")).toContainText(
    "Authorization",
  );
  await expect(loadButton(page)).toBeDisabled();
  await expect(mcp.getByLabel("Authorization")).toHaveAttribute(
    "aria-required",
    "true",
  );

  await mcp.getByLabel("Authorization").fill("glpat-fake");
  await expect(loadButton(page)).toBeEnabled();
  await expect(page.getByTestId("inspector-missing-header")).toHaveCount(0);
});

test("the island speaks Spanish on /es/", async ({ page }) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/es/inspector/");
  const mcp = inspector(page);

  await expect(mcp.getByLabel("Servidor")).toBeVisible();
  // The tabs are translated too.
  await expect(mcp.getByRole("tab", { name: "Prompts" })).toBeVisible();
  // The protocol's identifiers are NOT translated: they are what has to be
  // typed into a real MCP client.
  await expect(loadButton(page)).toBeVisible();

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");
});

test("Enter in the form fires the call", async ({ page }) => {
  const sent = await stubMcp(page, (method) =>
    method === "tools/call" ? { json: TOOL_OK } : { json: TOOLS_LIST },
  );
  await page.goto("/inspector/");

  await pickTool(page, "search");
  // Enter in a single-line control submits: going down to the button with the
  // form already filled in is friction for nothing.
  await page.locator(".arg input, .arg textarea").first().press("Enter");

  await expect
    .poll(() => sent.filter((r) => r.body.method === "tools/call").length)
    .toBe(1);
  expect(sent.at(-1)?.body).toMatchObject({
    method: "tools/call",
    params: { name: "search" },
  });
});

test("the brake cuts a burst: fifteen clicks are not fifteen requests", async ({
  page,
}) => {
  // The point of the brake is not that it refuses — it is that the requests
  // never leave. Counting what the stub received is the only assertion that
  // actually proves that; a message on screen would prove nothing.
  const sent = await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");

  for (let i = 0; i < 15; i++) {
    // Both of these are the test, not sloppiness: `force` because a click
    // may land while the button is briefly disabled mid-flight, and the fixed
    // wait because the interval between clicks IS the thing under test — the
    // brake is defined in milliseconds, so nothing else can stand in for it.
    // eslint-disable-next-line playwright/no-force-option
    await loadButton(page).click({ force: true });
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(120);
  }
  await expect(status(page)).toContainText("Slow down");
  expect(sent.length).toBeLessThan(15);
});

test("the response reads laid out, and the JSON is still one click away", async ({
  page,
}) => {
  await stubMcp(page, (method) => ({
    json: method === "tools/call" ? TOOL_OK : TOOLS_LIST,
  }));
  await page.goto("/inspector/");
  await loadButton(page).click();
  await toolSelect(page).selectOption("search");
  await runButton(page).click();

  const out = page.getByTestId("inspector-output");
  // Reader first: the text of the answer, without the JSON scaffolding.
  await expect(out).toContainText("1 result");
  await expect(out.locator("pre")).toHaveCount(0);

  // Scoped to the switch: the arguments form has its own JSON button, and
  // the two mean different things — one picks how you WRITE the call, this
  // one picks how you READ the answer.
  await page
    .locator(".view-switch")
    .getByRole("button", { name: "JSON" })
    .click();
  // And the exact body is still one click away, which is the whole deal.
  await expect(out.locator("pre")).toHaveCount(1);
  await expect(out).toContainText("jsonrpc");
});

// This test used to say the opposite — "with nothing to lay out the switch
// does not appear: the JSON IS the answer" — because the reader handled one
// shape only and an EMPTY reader would have hidden the answer. The reader
// now lays out every shape and is never empty, so a list gets one too; what
// this pins instead is that the raw body is still one click away.
test("a list is laid out too, and its JSON is one click away", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");

  const out = page.getByTestId("inspector-output");
  await expect(out).toContainText("2 tools");
  await expect(out).toContainText("Search Library Genesis");
  await expect(out.locator("pre")).toHaveCount(0);

  await page
    .locator(".view-switch")
    .getByRole("button", { name: "JSON" })
    .click();
  await expect(out.locator("pre")).toHaveCount(1);
  await expect(out).toContainText("jsonrpc");
});

// The author's rule: whatever acts on the answer goes with the answer. The
// switch, Copy and Cancel all share the status line right above it; the window
// bar keeps only the title, and the tab row only what STARTS a call. Cancel
// matters most: pressing "Run tool" at the bottom of a long form used to make
// the only way to stop the call appear at the top, off a phone's screen.
test("everything that acts on the answer sits with the answer", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/");
  await loadButton(page).click();
  const row = page.locator(".response-head");
  await expect(row.locator(".view-switch")).toBeVisible();
  await expect(row.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.locator(".term-bar button")).toHaveCount(0);

  // One bar where there is room, two on a narrow screen with the buttons on
  // top — the author's layout. Checked by where they actually land, since the
  // placement is CSS and the source order is the same in both.
  const tops = async () =>
    row.evaluate((head) => {
      const top = (sel: string) =>
        Math.round(head.querySelector(sel)!.getBoundingClientRect().top);
      return { actions: top(".status-actions"), status: top(".term-status") };
    });
  await page.setViewportSize({ width: 1280, height: 800 });
  const wide = await tops();
  expect(Math.abs(wide.actions - wide.status)).toBeLessThan(12);
  await page.setViewportSize({ width: 440, height: 800 });
  const narrow = await tops();
  expect(narrow.actions).toBeLessThan(narrow.status);
});

test("Cancel appears beside the running call, not up in the tab row", async ({
  page,
}) => {
  await stubMcp(page, () => ({ hang: true }));
  await page.goto("/inspector/");
  await loadButton(page).click();
  await expect(
    page.locator(".response-head").getByTestId("inspector-cancel"),
  ).toBeVisible();
  await expect(
    page.locator(".tabs-row").getByTestId("inspector-cancel"),
  ).toHaveCount(0);
});

test("the Instructions tab reads them from initialize and lays them out", async ({
  page,
}) => {
  await stubMcp(page, (method) => ({
    json:
      method === "initialize"
        ? {
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2025-11-25",
              serverInfo: { name: "libgen-mcp", version: "1.7.2" },
              capabilities: { tools: {} },
              instructions: "WORKFLOW\n\n1. search\n2. read",
            },
          }
        : TOOLS_LIST,
  }));
  await page.goto("/inspector/");
  await page.getByRole("tab", { name: "Instructions" }).click();
  await page.getByTestId("load-instructions").click();
  const box = page.locator(".server-instructions");
  await expect(box).toContainText("WORKFLOW");
  // Laid out as a list, not left as one line with the breaks escaped.
  await expect(box.locator("ol li")).toHaveCount(2);

  await page.getByRole("tab", { name: "Server" }).click();
  await expect(page.locator(".server-facts")).toContainText("1.7.2");
});

test("a category the server does not implement says so instead of erroring", async ({
  page,
}) => {
  await stubMcp(page, () => ({
    json: {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32_601, message: 'method not found: "resources/list"' },
    },
  }));
  await page.goto("/inspector/");
  await page.getByRole("tab", { name: "Resources" }).click();
  await page.getByTestId("load-resources").click();
  await expect(page.getByTestId("catalog-resources")).toContainText(
    "does not offer this",
  );
});
