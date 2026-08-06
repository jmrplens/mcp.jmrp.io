import { expect, test } from "@playwright/test";

import { inspector, loadButton, pickTool, runButton, serverSelect, stubMcp, TOOLS_LIST, toolSelect } from "./helpers";

/**
 * Lo que convierte el volcado de JSON en un inspector usable: elegir la tool de
 * una lista, ver qué argumentos acepta, y distinguir un fallo de un acierto.
 *
 * Todas las respuestas están stubbeadas a propósito. Estos tests no comprueban
 * que los MCP funcionen —de eso se encarga `inspector.spec.ts` contra
 * producción— sino que la interfaz pinta cada caso de forma distinta, y hay
 * casos (un `isError: true`, un 400, una petición que no vuelve nunca) que no
 * se pueden provocar a voluntad contra el servidor real.
 */

/** Un `tools/call` que falla DENTRO de la tool: HTTP 200 y forma de `result`. */
const TOOL_ERROR = {
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: "query is required" }], isError: true },
};

const TOOL_OK = {
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: "1 result" }] },
};

const status = (page: Parameters<typeof inspector>[0]) =>
  page.getByTestId("inspector-status");

test("tras tools/list la tool se elige de una lista, no se teclea", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/");
  const mcp = inspector(page);

  // Antes de cargar no hay catálogo ni forma de elegir: solo la invitación.
  await expect(toolSelect(page)).toHaveCount(0);
  await expect(mcp).toContainText("No tools loaded yet");

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");

  const tool = toolSelect(page);
  await expect(tool).toHaveRole("combobox");
  // Los nombres salen del servidor, no de una lista escrita en el sitio.
  await expect(tool.locator("option")).toHaveText([
    /pick a tool/,
    "search",
    "download",
  ]);
});

test("elegir una tool enseña su inputSchema y prerrellena lo obligatorio", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/");
  const mcp = inspector(page);
  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");

  await toolSelect(page).selectOption("search");

  // El formulario sustituyó al JSON crudo: cada propiedad es un campo, con su
  // descripción y marcada si es obligatoria. Mandar `{}` daba "query is
  // required" e inventarse una propiedad daba "unexpected additional
  // properties"; las dos cosas pasaron de verdad en la auditoría.
  const form = page.getByTestId("args-form");
  await expect(form).toBeVisible();
  await expect(form).toContainText("query");
  await expect(form).toContainText("What to look for");
  // También las opcionales, que es lo que evita adivinar de más.
  await expect(form).toContainText("results_per_page");
  // La descripción de la tool acompaña al formulario.
  await expect(mcp).toContainText("Search Library Genesis");
});

test("cambiar de servidor no deja ofreciendo las tools del anterior", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/");
  await loadButton(page).click();
  await expect(toolSelect(page)).toHaveRole("combobox");

  await serverSelect(page).selectOption("gitlab");
  // Ofrecer las tools del servidor anterior sería peor que no ofrecer nada:
  // el desplegable daría nombres que este otro no implementa.
  await expect(toolSelect(page)).toHaveCount(0);
});

test("un acierto y un isError:true NO se ven igual", async ({ page }) => {
  await stubMcp(page, (method) => ({
    json: method === "tools/call" ? TOOL_OK : TOOLS_LIST,
  }));
  await page.goto("/");
  const out = page.getByTestId("inspector-output");

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");
  await toolSelect(page).selectOption("search");
  await runButton(page).click();

  await expect(status(page)).toContainText("OK");
  await expect(out).not.toHaveClass(/is-error/);
});

test("un tools/call con isError:true se pinta como fallo aunque sea HTTP 200", async ({
  page,
}) => {
  await stubMcp(page, (method) => ({
    // 200 a propósito: este es EL caso que se colaba como éxito.
    status: 200,
    json: method === "tools/call" ? TOOL_ERROR : TOOLS_LIST,
  }));
  await page.goto("/");

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");
  await toolSelect(page).selectOption("search");
  await runButton(page).click();

  await expect(status(page)).toContainText("tool error");
  await expect(status(page)).toContainText("query is required");
  await expect(page.getByTestId("inspector-output")).toHaveClass(/is-error/);
});

test("un error de transporte dice su código HTTP", async ({ page }) => {
  await stubMcp(page, () => ({ status: 400, body: "no server available" }));
  await page.goto("/");
  await loadButton(page).click();

  await expect(status(page)).toContainText("transport error");
  await expect(status(page)).toContainText("400");
  await expect(page.getByTestId("inspector-output")).toHaveClass(/is-error/);
});

test("un error JSON-RPC lleva su código, no el HTTP", async ({ page }) => {
  await stubMcp(page, () => ({
    json: {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32_602, message: "unexpected additional properties" },
    },
  }));
  await page.goto("/");
  await loadButton(page).click();

  await expect(status(page)).toContainText("JSON-RPC error");
  await expect(status(page)).toContainText("-32602");
  await expect(status(page)).toContainText("unexpected additional properties");
});

test("la línea de estado da método, código, tiempo y tamaño", async ({ page }) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/");
  await loadButton(page).click();

  const line = status(page);
  await expect(line).toContainText("tools/list");
  await expect(line).toContainText("200");
  // Un tiempo (ms o s) y un tamaño (B o kB): las dos cifras que faltaban.
  await expect(line).toContainText(/\d+(\.\d+)? (ms|s)/);
  await expect(line).toContainText(/\d+(\.\d+)? (B|kB)/);
});

test("el lector de pantalla oye el resumen, no el volcado entero", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/");
  const out = page.getByTestId("inspector-output");

  // El aria-live colgaba del <pre>: 43.260 caracteres anunciados de una tacada.
  await expect(out).toHaveAttribute("aria-live", "off");
  await expect(out).toHaveAttribute("tabindex", "0");
  await expect(out).toHaveRole("region");
  await expect(status(page)).toHaveRole("status");
});

test("la respuesta se puede copiar", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/");
  const mcp = inspector(page);
  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");

  await mcp.getByRole("button", { name: "Copy" }).click();
  await expect(status(page)).toContainText("Response copied");

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('"search"');
});

test("una petición en vuelo se puede cancelar", async ({ page }) => {
  await stubMcp(page, () => ({ hang: true }));
  await page.goto("/");
  await loadButton(page).click();

  const cancel = page.getByTestId("inspector-cancel");
  await expect(cancel).toBeVisible();
  await expect(status(page)).toContainText("running");

  await cancel.click();
  await expect(status(page)).toContainText("Cancelled");
  await expect(cancel).toBeHidden();
  // Y se vuelve a poder pedir algo: cancelar no deja la isla inservible.
  await expect(loadButton(page)).toBeEnabled();
});

test("una cabecera obligatoria vacía bloquea el envío y dice por qué", async ({
  page,
}) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");

  // Sin esto el visitante recibía un 400 con el texto del upstream, «no server
  // available», que se lee como «el servidor está caído».
  await expect(page.getByTestId("inspector-missing-header")).toContainText(
    "PRIVATE-TOKEN",
  );
  await expect(loadButton(page)).toBeDisabled();
  await expect(mcp.getByLabel("PRIVATE-TOKEN")).toHaveAttribute(
    "aria-required",
    "true",
  );

  await mcp.getByLabel("PRIVATE-TOKEN").fill("glpat-de-mentira");
  await expect(loadButton(page)).toBeEnabled();
  await expect(page.getByTestId("inspector-missing-header")).toHaveCount(0);
});

test("la isla habla español en /es/", async ({ page }) => {
  await stubMcp(page, () => ({ json: TOOLS_LIST }));
  await page.goto("/es/");
  const mcp = inspector(page);

  await expect(mcp.getByLabel("Servidor")).toBeVisible();
  // Las pestañas también están traducidas.
  await expect(mcp.getByRole("tab", { name: "Prompts" })).toBeVisible();
  // Los identificadores del protocolo NO se traducen: son lo que hay que
  // teclear en un cliente MCP de verdad.
  await expect(loadButton(page)).toBeVisible();

  await loadButton(page).click();
  await expect(status(page)).toContainText("2 tools");
});

test("Enter en el formulario lanza la llamada", async ({ page }) => {
  const sent = await stubMcp(page, (method) =>
    method === "tools/call" ? { json: TOOL_OK } : { json: TOOLS_LIST },
  );
  await page.goto("/");

  await pickTool(page, "search");
  // Enter en un control de una línea envía: bajar al botón con el formulario
  // ya relleno es fricción gratuita.
  await page.locator(".arg input, .arg textarea").first().press("Enter");

  await expect.poll(() => sent.filter((r) => r.body.method === "tools/call").length).toBe(1);
  expect(sent.at(-1)?.body).toMatchObject({
    method: "tools/call",
    params: { name: "search" },
  });
});
