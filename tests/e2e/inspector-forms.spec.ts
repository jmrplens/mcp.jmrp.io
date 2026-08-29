import { expect, test } from "@playwright/test";

import { inspector, serverSelect, stubMcp } from "./helpers";

/**
 * The form is what separates "trying an MCP" from "knowing its schema". The
 * inspector used to ask for the arguments as raw JSON: the interface an LLM
 * needs, not a person.
 */

// eslint-disable-next-line playwright/no-skipped-test
test.skip(
  !!process.env.E2E_NO_NETWORK,
  "requires Internet access to mcp.jmrp.io",
);

test("tools are picked from a list and their schema becomes a form", async ({
  page,
}) => {
  await page.goto("/inspector/");
  await page.getByTestId("load-tools").click();

  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible({ timeout: 40_000 });
  await picker.selectOption("search");

  const form = page.getByTestId("args-form");
  await expect(form).toBeVisible();

  // `query` is required on libgen and is marked as such.
  await expect(form.getByText("query", { exact: false }).first()).toBeVisible();
  // An enum is asked for with a dropdown, not by typing the value blind.
  await expect(form.locator("select").first()).toBeVisible();
  // And an integer with a numeric control.
  await expect(form.locator('input[type="number"]').first()).toBeVisible();
});

test("a real search is launched from the form, with no JSON typed", async ({
  page,
}) => {
  // Against the real server: a search hits several mirrors and takes longer
  // than the test's default 30 s.
  //
  // Since the deployment runs with `LIBGEN_MCP_EXTRA_SOURCES=always`
  // (2026-08-22), EVERY search additionally queries Anna's Archive, arXiv,
  // Crossref, OpenLibrary, Gutenberg, dblp, PubMed and ERIC, instead of doing
  // so only when the catalog comes back empty. Measured against production:
  // 92 s and 114 s on two consecutive runs, so the previous 60 s fell short
  // and the test was failing on the clock, not on a fault.
  test.setTimeout(240_000);
  await page.goto("/inspector/");
  await page.getByTestId("load-tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible({ timeout: 40_000 });
  await picker.selectOption("search");

  await page.locator(".arg textarea").first().fill("the hobbit tolkien");
  await page.getByRole("button", { name: "Run tool" }).click();

  const status = page.getByTestId("inspector-status");
  await expect(status).toContainText("tools/call", { timeout: 60_000 });
  await expect(status).toContainText("OK", { timeout: 180_000 });
  await expect(page.getByTestId("inspector-output")).toContainText("result");
});

test("prompts are listed with their arguments and can be rendered", async ({
  page,
}) => {
  await page.goto("/inspector/");
  await page.getByRole("tab", { name: "Prompts" }).click();
  await page.getByTestId("load-prompts").click();

  const picker = page.getByTestId("catalog-prompts").locator("select");
  await expect(picker).toBeVisible({ timeout: 40_000 });
  await picker.selectOption("acquire_book");

  // The prompt declares `title` as required: it has to show up as a field.
  const form = page.getByTestId("args-form");
  await expect(form.getByText("title", { exact: false }).first()).toBeVisible();

  await form.locator("input, textarea").first().fill("The Hobbit");
  await page.getByRole("button", { name: /Render prompt/i }).click();
  await expect(page.getByTestId("inspector-status")).toContainText(
    "prompts/get",
    { timeout: 60_000 },
  );
});

test("resources are listed with their MIME type and can be read", async ({
  page,
}) => {
  // Stubbed rather than against production: what is checked is that the
  // catalog renders and that `resources/read` goes out with the chosen URI, not
  // what gitlab answers today. The real server also takes long enough to run
  // the test out of time.
  const sent = await stubMcp(page, (method) =>
    method === "resources/list"
      ? {
          json: {
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
          },
        }
      : { json: { jsonrpc: "2.0", id: 1, result: { contents: [] } } },
  );

  await page.goto("/inspector/");
  await serverSelect(page).selectOption("gitlab");
  await inspector(page).getByLabel("Authorization").fill("glpat-fake");

  await page.getByRole("tab", { name: "Resources" }).click();
  await page.getByTestId("load-resources").click();

  const picker = page.getByTestId("catalog-resources").locator("select");
  await expect(picker).toBeVisible();
  // The MIME type travels in the option: it says what will be read before reading it.
  await expect(picker).toContainText("text/markdown");

  await picker.selectOption("gitlab://guides/code-review");
  await page.getByRole("button", { name: /Read resource/i }).click();

  await expect(page.getByTestId("inspector-status")).toContainText(
    "resources/read",
  );
  const read = sent.find((r) => r.body.method === "resources/read");
  expect(read?.body.params).toEqual({ uri: "gitlab://guides/code-review" });
});

test("switching servers does not leave the previous one's catalog behind", async ({
  page,
}) => {
  await page.goto("/inspector/");
  await page.getByTestId("load-tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible({ timeout: 40_000 });

  await serverSelect(page).selectOption("gitlab");
  await expect(inspector(page).getByTestId("args-form")).toBeHidden();
  await expect(picker).toBeHidden();
});
