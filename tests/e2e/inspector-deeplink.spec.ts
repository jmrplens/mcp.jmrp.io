import { expect, test } from "@playwright/test";

import {
  inspector,
  loadButton,
  serverSelect,
  stubMcp,
  TOOLS_LIST,
} from "./helpers";

/**
 * The inspector's deep link: `?server=&tab=&name=`, read once on entry so a
 * `/servers/` page can link straight into a preselected tool/prompt/resource
 * instead of "open the inspector, pick a server, pick a tab, find it".
 *
 * All responses are stubbed, same rationale as `inspector-ui.spec.ts`: these
 * tests are about what the URL does to the island's OWN state, not about what a
 * real MCP server answers.
 */

const PROMPTS_LIST = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    prompts: [
      {
        name: "review_mr",
        description: "Review a merge request",
        arguments: [],
      },
      { name: "triage_issue", description: "Triage an issue", arguments: [] },
    ],
  },
};

const RESOURCES_LIST = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    resources: [
      {
        uri: "gitlab://guides/code-review",
        name: "code_review",
        mimeType: "text/markdown",
      },
    ],
  },
};

/** Fills GitLab's only required header so its catalogs can load. */
async function unblockGitlab(page: Parameters<typeof inspector>[0]) {
  await inspector(page).getByLabel("Authorization").fill("glpat-fake");
}

test("valid server+tab+name: the tab and the server are already set on entry", async ({
  page,
}) => {
  await stubMcp(page, (method) => ({
    json: method === "prompts/list" ? PROMPTS_LIST : TOOLS_LIST,
  }));
  await page.goto("/inspector/?server=gitlab&tab=prompts&name=review_mr");
  const mcp = inspector(page);

  // The server and the tab are read from the URL without anyone touching anything.
  await expect(serverSelect(page)).toHaveValue("gitlab");
  await expect(mcp.getByRole("tab", { name: "Prompts" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Before the catalog loads there is nothing to select: the URL's `name`
  // cannot be applied until `prompts/list` answers. This is what proves the
  // hook is in the right place and not too early.
  await expect(
    page.getByTestId("catalog-prompts").locator("select"),
  ).toHaveCount(0);

  await unblockGitlab(page);
  await loadButton(page, "prompts").click();

  const picker = page.getByTestId("catalog-prompts").locator("select");
  await expect(picker).toBeVisible();
  // And here it does: the URL's prompt selects itself, without touching the dropdown.
  await expect(picker).toHaveValue("review_mr");
  // The invocation header (name + description) confirms the SAME selection
  // `choosePrompt` would make was applied, not just the `<select>`'s internal
  // value. `review_mr` declares no arguments, so there is no `args-form` — the
  // "no arguments" notice fills that slot.
  await expect(mcp).toContainText("review_mr — Review a merge request");
  await expect(mcp).toContainText("This tool takes no arguments.");
});

test("a name that is a resource's uri selects by uri, not by its visible name", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: RESOURCES_LIST }));
  const uri = "gitlab://guides/code-review";
  await page.goto(
    `/inspector/?server=gitlab&tab=resources&name=${encodeURIComponent(uri)}`,
  );

  await expect(serverSelect(page)).toHaveValue("gitlab");
  await expect(
    inspector(page).getByRole("tab", { name: "Resources" }),
  ).toHaveAttribute("aria-selected", "true");

  await unblockGitlab(page);
  await loadButton(page, "resources").click();

  const picker = page.getByTestId("catalog-resources").locator("select");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue(uri);
  // The read button only appears with a resource selected: indirect proof the
  // selection really was applied and not just the `<select>`'s internal
  // value.
  await expect(
    page.getByRole("button", { name: /Read resource/i }),
  ).toBeVisible();
});

test("an invalid server, tab and name fall back to the defaults without breaking the island", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto(
    "/inspector/?server=not-a-real-server&tab=not-a-real-tab&name=not-a-real-tool",
  );
  const mcp = inspector(page);

  // Server: the first in the list, like entering /inspector/ with nothing.
  await expect(serverSelect(page)).toHaveValue("libgen");
  // Tab: "tools", the default — not what came in the URL.
  await expect(mcp.getByRole("tab", { name: "Tools" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await loadButton(page, "tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible();
  // Nothing preselected: the invitation to choose is still the active option.
  await expect(picker).toHaveValue("");
});

test("a name that does not exist in the real catalog selects nothing, but the catalog loads normally", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto(
    "/inspector/?server=libgen&tab=tools&name=this_tool_does_not_exist",
  );

  await loadButton(page, "tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue("");
  // The catalog itself is unaffected: both real tools are still there.
  await expect(picker.locator("option")).toHaveText([
    /pick a tool/,
    "search",
    "download",
  ]);
});

test("an unrelated parameter such as Authorization in the URL does not fill the token field", async ({
  page,
}) => {
  // This is the case the "never a credential parameter" rule exists to
  // prevent: someone pastes a link with a fake token (or a real one) expecting
  // it to "come pre-filled", and the inspector must NOT read it.
  await page.goto(
    "/inspector/?server=gitlab&Authorization=glpat-should-be-ignored",
  );
  await expect(inspector(page).getByLabel("Authorization")).toHaveValue("");
});
