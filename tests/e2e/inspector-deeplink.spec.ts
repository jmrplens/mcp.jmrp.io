import { expect, test } from "@playwright/test";

import { inspector, loadButton, serverSelect, stubMcp, TOOLS_LIST } from "./helpers";

/**
 * The inspector's deep link: `?server=&tab=&name=`, read once on entry so a
 * `/servers/` page can link straight into a preselected tool/prompt/resource
 * instead of "open the inspector, pick a server, pick a tab, find it".
 *
 * All responses are stubbed, same rationale as `inspector-ui.spec.ts`: these
 * tests are about what the URL does to the isla's OWN state, not about what a
 * real MCP server answers.
 */

const PROMPTS_LIST = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    prompts: [
      { name: "review_mr", description: "Review a merge request", arguments: [] },
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
  await inspector(page).getByLabel("PRIVATE-TOKEN").fill("glpat-de-mentira");
}

test("server+tab+name válidos: la pestaña y el servidor ya están puestos al entrar", async ({
  page,
}) => {
  await stubMcp(page, (method) => ({
    json: method === "prompts/list" ? PROMPTS_LIST : TOOLS_LIST,
  }));
  await page.goto("/inspector/?server=gitlab&tab=prompts&name=review_mr");
  const mcp = inspector(page);

  // El servidor y la pestaña se leen de la URL sin que nadie toque nada.
  await expect(serverSelect(page)).toHaveValue("gitlab");
  await expect(mcp.getByRole("tab", { name: "Prompts" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Antes de cargar el catálogo no hay nada que seleccionar: el `name` de la
  // URL no puede aplicarse hasta que `prompts/list` conteste. Esto es lo que
  // prueba que el enganche está en el sitio correcto y no antes de tiempo.
  await expect(page.getByTestId("catalog-prompts").locator("select")).toHaveCount(0);

  await unblockGitlab(page);
  await loadButton(page, "prompts").click();

  const picker = page.getByTestId("catalog-prompts").locator("select");
  await expect(picker).toBeVisible();
  // Y aquí sí: el prompt de la URL queda elegido solo, sin tocar el desplegable.
  await expect(picker).toHaveValue("review_mr");
  // La cabecera de invocación (nombre + descripción) confirma que se aplicó
  // la MISMA selección que haría `choosePrompt`, no solo el valor del
  // `<select>` por dentro. `review_mr` no declara argumentos, así que no hay
  // `args-form` — el hueco lo llena el aviso de "sin argumentos".
  await expect(mcp).toContainText("review_mr — Review a merge request");
  await expect(mcp).toContainText("This tool takes no arguments.");
});

test("un name que es la uri de un resource se selecciona por su uri, no por su nombre visible", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: RESOURCES_LIST }));
  const uri = "gitlab://guides/code-review";
  await page.goto(`/inspector/?server=gitlab&tab=resources&name=${encodeURIComponent(uri)}`);

  await expect(serverSelect(page)).toHaveValue("gitlab");
  await expect(inspector(page).getByRole("tab", { name: "Resources" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await unblockGitlab(page);
  await loadButton(page, "resources").click();

  const picker = page.getByTestId("catalog-resources").locator("select");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue(uri);
  // El botón de leer solo aparece con un recurso elegido: prueba indirecta de
  // que la selección se aplicó de verdad y no solo el `<select>` por dentro.
  await expect(page.getByRole("button", { name: /Read resource/i })).toBeVisible();
});

test("server, tab y name inválidos caen a los valores por defecto sin romper la isla", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/?server=not-a-real-server&tab=not-a-real-tab&name=not-a-real-tool");
  const mcp = inspector(page);

  // Servidor: el primero de la lista, como una entrada a /inspector/ sin nada.
  await expect(serverSelect(page)).toHaveValue("libgen");
  // Tab: "tools", el valor por defecto — no lo que venía en la URL.
  await expect(mcp.getByRole("tab", { name: "Tools" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await loadButton(page, "tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible();
  // Nada preseleccionado: la invitación a elegir sigue siendo la opción activa.
  await expect(picker).toHaveValue("");
});

test("un name que no existe en el catálogo real no selecciona nada, pero el catálogo carga normal", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/inspector/?server=libgen&tab=tools&name=this_tool_does_not_exist");

  await loadButton(page, "tools").click();
  const picker = page.getByTestId("catalog-tools").locator("select");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue("");
  // El catálogo en sí no se ve afectado: las dos tools reales siguen ahí.
  await expect(picker.locator("option")).toHaveText([/pick a tool/, "search", "download"]);
});

test("un parámetro ajeno como PRIVATE-TOKEN en la URL no rellena el campo del token", async ({
  page,
}) => {
  // Este es el caso que la regla "nunca un parámetro de credencial" existe
  // para evitar: alguien pega un enlace con un token de mentira (o de
  // verdad) esperando que "ya venga puesto", y el inspector NO debe leerlo.
  await page.goto("/inspector/?server=gitlab&PRIVATE-TOKEN=glpat-deberia-ignorarse");
  await expect(inspector(page).getByLabel("PRIVATE-TOKEN")).toHaveValue("");
});
