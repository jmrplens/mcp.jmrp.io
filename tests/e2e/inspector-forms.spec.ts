import { expect, test } from "@playwright/test";

import { inspector, serverSelect, stubMcp } from "./helpers";

/**
 * El formulario es lo que separa "probar un MCP" de "saberse su esquema".
 * Antes el inspector pedía los argumentos como JSON crudo: la interfaz que
 * necesita un LLM, no una persona.
 */

// eslint-disable-next-line playwright/no-skipped-test
test.skip(
  !!process.env.E2E_NO_NETWORK,
  "requiere salida a Internet contra mcp.jmrp.io",
);

test("las tools se eligen de una lista y su esquema se vuelve formulario", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("load-tools").click();

  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible({ timeout: 40_000 });
  await picker.selectOption("search");

  const form = page.getByTestId("args-form");
  await expect(form).toBeVisible();

  // `query` es obligatorio en libgen y se marca como tal.
  await expect(form.getByText("query", { exact: false }).first()).toBeVisible();
  // Un enum se pide con desplegable, no escribiendo el valor a ciegas.
  await expect(form.locator("select").first()).toBeVisible();
  // Y un entero con un control numérico.
  await expect(form.locator('input[type="number"]').first()).toBeVisible();
});

test("una búsqueda real se lanza desde el formulario, sin escribir JSON", async ({
  page,
}) => {
  // Contra el servidor de verdad: una búsqueda consulta varios mirrors y pasa
  // de los 30 s por defecto del test.
  //
  // Desde que el despliegue corre con `LIBGEN_MCP_EXTRA_SOURCES=always`
  // (2026-08-22), CADA búsqueda consulta además Anna's Archive, arXiv,
  // Crossref, OpenLibrary, Gutenberg, dblp, PubMed y ERIC, en lugar de hacerlo
  // solo cuando el catálogo viene vacío. Medido contra producción: 92 s y
  // 114 s en dos intentos seguidos, así que los 60 s de antes se quedaban
  // cortos y el test fallaba por reloj, no por avería.
  test.setTimeout(240_000);
  await page.goto("/");
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

test("los prompts se listan con sus argumentos y se pueden renderizar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Prompts" }).click();
  await page.getByTestId("load-prompts").click();

  const picker = page.getByTestId("catalog-prompts").locator("select");
  await expect(picker).toBeVisible({ timeout: 40_000 });
  await picker.selectOption("acquire_book");

  // El prompt declara `title` obligatorio: tiene que salir como campo.
  const form = page.getByTestId("args-form");
  await expect(form.getByText("title", { exact: false }).first()).toBeVisible();

  await form.locator("input, textarea").first().fill("El Hobbit");
  await page.getByRole("button", { name: /Render prompt/i }).click();
  await expect(page.getByTestId("inspector-status")).toContainText(
    "prompts/get",
    { timeout: 60_000 },
  );
});

test("los resources se listan con su tipo MIME y se pueden leer", async ({
  page,
}) => {
  // Con stub y no contra producción: lo que se comprueba es que el catálogo se
  // pinta y que `resources/read` sale con el URI elegido, no lo que conteste
  // gitlab hoy. Además el servidor real tarda lo bastante como para agotar el
  // límite del test.
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

  await page.goto("/");
  await serverSelect(page).selectOption("gitlab");
  await inspector(page).getByLabel("PRIVATE-TOKEN").fill("glpat-falso");

  await page.getByRole("tab", { name: "Resources" }).click();
  await page.getByTestId("load-resources").click();

  const picker = page.getByTestId("catalog-resources").locator("select");
  await expect(picker).toBeVisible();
  // El tipo MIME va en la opción: dice qué se va a leer antes de leerlo.
  await expect(picker).toContainText("text/markdown");

  await picker.selectOption("gitlab://guides/code-review");
  await page.getByRole("button", { name: /Read resource/i }).click();

  await expect(page.getByTestId("inspector-status")).toContainText(
    "resources/read",
  );
  const read = sent.find((r) => r.body.method === "resources/read");
  expect(read?.body.params).toEqual({ uri: "gitlab://guides/code-review" });
});

test("cambiar de servidor no deja el catálogo del anterior", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("load-tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible({ timeout: 40_000 });

  await serverSelect(page).selectOption("gitlab");
  await expect(inspector(page).getByTestId("args-form")).toBeHidden();
  await expect(picker).toBeHidden();
});
