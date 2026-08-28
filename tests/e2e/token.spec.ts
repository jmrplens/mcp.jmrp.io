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

// Token de mentira: si alguna vez aparece en storage, cookies o URL, el test
// falla. No hace falta que sea válido porque estos tests no llaman al servidor.
const TOKEN = "glpat-secreto-de-prueba";

/**
 * Petición que el navegador intentó mandar a un MCP, ya capturada.
 * `headers` viene con los nombres en minúscula (así los da Playwright).
 */
type Sent = { url: string; headers: Record<string, string>; body: unknown };

// La respuesta se sirve desde el propio test, así que estos tests NO necesitan
// salida a Internet. Al ser peticiones a otro origen (mcp.jmrp.io desde
// localhost) hay que devolver las cabeceras de CORS o el navegador tira la
// respuesta y el inspector solo vería un TypeError.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

/** Respuesta de una tool que funciona. */
const TOOL_OK = {
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: "1 result" }] },
};

const SSE_BODY = 'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n';

/**
 * Intercepta los endpoints MCP y devuelve el array donde se van anotando las
 * peticiones. Es lo que permite comprobar QUÉ sale del navegador: cabeceras y
 * cuerpo, que es justo el cableado que construye esta tarea.
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

test("el campo de token es password y no se persiste", async ({ page }) => {
  await page.goto("/inspector/");
  // Acotado a la isla: la sección de servidores es una región llamada
  // "Servers", así que un getByLabel a nivel de página es ambiguo.
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

  // Ni cookies ni query string: son las otras dos formas de que un secreto
  // sobreviva a la pestaña o acabe en los logs de un proxy.
  const cookies = JSON.stringify(await page.context().cookies());
  expect(cookies).not.toContain(TOKEN);
  expect(page.url()).not.toContain(TOKEN);

  await page.reload();
  await serverSelect(page).selectOption("gitlab");
  await expect(mcp.getByLabel("Authorization")).toHaveValue("");
});

test("gitlab expone su cabecera opcional y libgen no pide nada", async ({
  page,
}) => {
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  // gitlab ya no declara ninguna cabecera opcional: desde --auth-mode=oauth la
  // instancia está fijada en el servidor y `GITLAB-URL` dejó de honrarse, así
  // que el formulario no debe seguir ofreciéndola.
  await expect(mcp.getByLabel("GITLAB-URL")).toHaveCount(0);

  // libgen no declara cabeceras: pedirle credenciales sería mentir al visitante.
  await serverSelect(page).selectOption("libgen");
  await expect(mcp.getByLabel("Authorization")).toHaveCount(0);
});

test("el token del visitante viaja como Authorization: Bearer", async ({
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
  // El esquema lo compone el inspector, no el visitante: lo que se teclea es
  // el token pelado y lo que sale por el cable lleva `Bearer ` delante. Es
  // justo la mitad que se rompería en silencio si alguien quitara
  // `valuePrefix` de la ficha del servidor.
  expect(sent[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
});

test("el token no se filtra al servidor que no lo declara", async ({
  page,
}) => {
  const sent = await stubMcp(page);
  await page.goto("/inspector/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  await mcp.getByLabel("Authorization").fill(TOKEN);

  // Cambiar de servidor sin recargar: el valor tecleado sigue en memoria, y
  // esta es la razón de que la clave del estado lleve el id del servidor
  // delante. Sin eso, el secreto de gitlab saldría hacia libgen.
  await serverSelect(page).selectOption("libgen");
  await loadButton(page).click();

  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].url).toContain("/libgen");
  expect(sent[0].headers.authorization).toBeUndefined();
  expect(JSON.stringify(sent[0].headers)).not.toContain(TOKEN);
});

test("los argumentos del formulario viajan con su tipo, no como texto", async ({
  page,
}) => {
  const sent = await stubMcpByMethod(page, (method: string) =>
    method === "tools/call" ? { json: TOOL_OK } : { json: TOOLS_LIST },
  );
  await page.goto("/inspector/");

  await pickTool(page, "search");
  // Se teclea en los campos del formulario, no en un JSON que haya que
  // saberse: eso es lo que el rediseño vino a arreglar.
  await page
    .getByTestId("args-form")
    .locator("input, textarea")
    .first()
    .fill("x");
  await runButton(page).click();

  const calls = () => sent.filter((r) => r.body.method === "tools/call");
  await expect.poll(() => calls().length).toBe(1);
  // `query` sale como cadena dentro de un objeto: el formulario convierte,
  // no concatena.
  expect(calls()[0].body).toMatchObject({
    method: "tools/call",
    params: { name: "search", arguments: { query: "x" } },
  });
  await expect(page.getByTestId("inspector-output")).toContainText("result");
});
