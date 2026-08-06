import { expect, type Page, test } from "@playwright/test";

import { inspector, serverSelect } from "./helpers";

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
  await page.goto("/");
  // Acotado a la isla: la sección de servidores es una región llamada
  // "Servers", así que un getByLabel a nivel de página es ambiguo.
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  const field = mcp.getByLabel("PRIVATE-TOKEN");
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
  await expect(mcp.getByLabel("PRIVATE-TOKEN")).toHaveValue("");
});

test("gitlab expone su cabecera opcional y libgen no pide nada", async ({
  page,
}) => {
  await page.goto("/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  // GITLAB-URL es opcional pero no es un secreto: campo de texto normal.
  await expect(mcp.getByLabel("GITLAB-URL")).toHaveAttribute("type", "text");

  // libgen no declara cabeceras: pedirle credenciales sería mentir al visitante.
  await serverSelect(page).selectOption("libgen");
  await expect(mcp.getByLabel("PRIVATE-TOKEN")).toHaveCount(0);
  await expect(mcp.getByLabel("GITLAB-URL")).toHaveCount(0);
});

test("el token del visitante viaja como cabecera PRIVATE-TOKEN", async ({
  page,
}) => {
  const sent = await stubMcp(page);
  await page.goto("/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  await mcp.getByLabel("PRIVATE-TOKEN").fill(TOKEN);
  await mcp.getByLabel("GITLAB-URL").fill("https://gitlab.example");
  await mcp.getByRole("button", { name: "tools/list" }).click();

  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].url).toContain("/gitlab");
  expect(sent[0].headers["private-token"]).toBe(TOKEN);
  expect(sent[0].headers["gitlab-url"]).toBe("https://gitlab.example");
});

test("el token no se filtra al servidor que no lo declara", async ({
  page,
}) => {
  const sent = await stubMcp(page);
  await page.goto("/");
  const mcp = inspector(page);
  await serverSelect(page).selectOption("gitlab");
  await mcp.getByLabel("PRIVATE-TOKEN").fill(TOKEN);

  // Cambiar de servidor sin recargar: el valor tecleado sigue en memoria, y
  // esta es la razón de que la clave del estado lleve el id del servidor
  // delante. Sin eso, el secreto de gitlab saldría hacia libgen.
  await serverSelect(page).selectOption("libgen");
  await mcp.getByRole("button", { name: "tools/list" }).click();

  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].url).toContain("/libgen");
  expect(sent[0].headers["private-token"]).toBeUndefined();
  expect(JSON.stringify(sent[0].headers)).not.toContain(TOKEN);
});

test("se puede invocar una tool con nombre y argumentos", async ({ page }) => {
  const sent = await stubMcp(page);
  await page.goto("/");
  const mcp = inspector(page);
  await expect(mcp.getByLabel("Arguments (JSON)")).toHaveValue("{}");

  await mcp.getByLabel("Tool").fill("search");
  await mcp.getByLabel("Arguments (JSON)").fill('{"query":"x"}');
  await mcp.getByRole("button", { name: "tools/call", exact: true }).click();

  await expect.poll(() => sent.length).toBe(1);
  // Los argumentos viajan como objeto, no como el string del textarea.
  expect(sent[0].body).toMatchObject({
    method: "tools/call",
    params: { name: "search", arguments: { query: "x" } },
  });
  await expect(page.getByTestId("inspector-output")).toContainText("tools");
});

test("la nota de seguridad es visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("security-note")).toBeVisible();
});

test("la nota de seguridad está traducida en /es/", async ({ page }) => {
  await page.goto("/es/");
  const note = page.getByTestId("security-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText("Revocarlo");
  // El enlace al código fuente es lo que hace verificable la promesa de la
  // nota: sin él, pedirle un token al visitante es solo palabrería.
  await expect(
    note.getByRole("link", { name: /repositorio/i }),
  ).toHaveAttribute("href", "https://github.com/jmrplens/mcp.jmrp.io");
});
