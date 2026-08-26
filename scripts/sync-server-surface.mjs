#!/usr/bin/env node
/**
 * Refresca los snapshots commiteados de la "superficie" viva de cada MCP
 * (src/data/surface/*.json): el resultado de `server/discover` de libgen y
 * gitlab, y el manifiesto de acciones `gitlab://tools` reducido.
 *
 * MISMO PATRÓN que src/lib/identity.ts y scripts/sync-server-cards.sh: se
 * consulta la fuente viva en cada build y el snapshot commiteado es el
 * respaldo para builds sin red o sin secretos (CI). Por eso un fallo de
 * red/token/forma es BLANDO (aviso + exit 0, snapshot intacto): un build en
 * CI sin credenciales debe seguir compilando con lo que hay en el repo.
 *
 * PROYECCIÓN POR WHITELIST, no passthrough: ningún campo futuro desconocido
 * de la respuesta puede colarse en el repo (que es público), los iconos ya
 * viven en src/data/cards/<id>.json y duplicarlos invita a divergencia, y el
 * manifiesto de 516 KB se reduce a lo que el buscador necesita (id, title,
 * domain, destructive, read_only) — las descriptions quedan fuera por
 * decisión cerrada del autor.
 *
 * GUARDIA ANTI-FUGA (fallo DURO, exit 1, antes de escribir un solo byte):
 * la instancia GitLab del autor no debe aparecer jamás en el repo. Si el
 * host de GITLAB_URL asoma en cualquier byte descargado o en cualquier
 * snapshot serializado, se aborta la cadena de build entera. Ningún mensaje
 * de este script imprime GITLAB_URL ni GITLAB_TOKEN; los textos de error del
 * servidor se sanean antes de loguearse por si lo ecoaran.
 *
 * ESCRITURA: determinista (orden de claves fijo, listas ordenadas por
 * comparación de bytes — nunca localeCompare, que depende de ICU) y solo si
 * hay cambio REAL ignorando meta.generatedAt: así `git diff` documenta
 * cambios de la API, no pasadas del build, y generatedAt queda como la fecha
 * del último cambio de verdad. Escritura atómica (temporal + rename en el
 * mismo directorio), como sync_one en sync-server-cards.sh.
 *
 * Los cache hints (ttlMs/cacheScope) se persisten como evidencia y se honran
 * refrescando por build, no por petición. `cacheScope: "private"` en gitlab
 * significa que el catálogo es la superficie DEL token usado, no universal —
 * de ahí que el sitio lo etiquete como obtenido "con un token Free" (copy
 * i18n del sitio, no de este snapshot: el extractor no puede saber el tier).
 *
 * Uso: node scripts/sync-server-surface.mjs
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// El .env del repo (gitignorado) trae GITLAB_URL/GITLAB_TOKEN en el servidor.
//
// A DIFERENCIA de deploy-live-mcp.mjs, aquí el FICHERO manda sobre el shell
// para esas dos claves. La convención del repo (shell > .env, exportar vacío
// anula) presupone que nadie exporta esas variables por otro motivo — y en
// este host es falso: el ~/.bashrc exporta un GITLAB_TOKEN de OTRO tooling
// (el CLI de la sesión de agentes). Heredarlo no falla ruidosamente: cambia
// la IDENTIDAD de la superficie publicada — con ese token el edge respondía
// 401 y el fallo blando congelaba el snapshot en silencio, y sin cabecera
// habría snapshoteado la superficie de la instancia POR DEFECTO (~100
// acciones menos, sin admin/storage_move; visto el 2026-08-26). Un dato
// citable con la identidad equivocada es el defecto que más caro nos ha
// costado en las auditorías; el opt-out aquí es editar el .env, no exportar.
function envValue(key) {
  try {
    const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
    const line = raw
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`) && !l.startsWith("#"));
    const value = line?.slice(key.length + 1).trim();
    if (value) return value;
  } catch {
    // Sin .env (CI): se sigue con lo que traiga el entorno.
  }
  return process.env[key];
}

const PROTOCOL_VERSION = "2026-07-28";
const BASE = "https://mcp.jmrp.io";
const SURFACE_DIR = path.join(process.cwd(), "src", "data", "surface");
const TAG = "[sync-server-surface]";

const GITLAB_TOKEN = envValue("GITLAB_TOKEN");
// GITLAB_URL arma la guardia anti-fuga Y viaja como cabecera GITLAB-URL en
// las peticiones de gitlab: sin la cabecera el edge consulta su instancia
// por defecto, que es OTRA superficie (verificado 2026-08-26: ~100 acciones
// menos, sin los dominios admin/storage_move). Un -40100 ("GitLab rejected
// this token") significa que el token de .env no vale para esa instancia
// (caducado o rotado): fallo blando, el snapshot commiteado se conserva.
// JAMÁS debe acabar en un log ni en un snapshot.
const GITLAB_URL = envValue("GITLAB_URL");

/**
 * Variantes en minúsculas del host de GITLAB_URL (con y sin puerto) que no
 * pueden aparecer en nada descargado, escrito ni logueado. Vacío si la
 * variable no está definida (entonces no hay nada que pueda fugarse).
 */
const FORBIDDEN_HOSTS = (() => {
  if (!GITLAB_URL) return [];
  try {
    const u = new URL(GITLAB_URL);
    return [...new Set([u.host, u.hostname].filter(Boolean))].map((h) =>
      h.toLowerCase(),
    );
  } catch {
    // Valor sin esquema ("host.ejemplo.com"): la guardia debe quedar armada
    // igual — el valor crudo como host, y recortado por si llevara puerto.
    // MISMO fallback que resolveNeedles() en tests/unit/surface-guards.test.mjs:
    // si los dos resolutores divergen, el build y su red de seguridad
    // inspeccionan cosas distintas y una fuga podría publicarse.
    const hostname = GITLAB_URL.split(":", 1)[0];
    return [...new Set([GITLAB_URL, hostname])]
      .filter(Boolean)
      .map((h) => h.toLowerCase());
  }
})();

/**
 * Sustituye el host prohibido en un texto destinado a un log. Los mensajes de
 * error del servidor podrían ecoar la cabecera GITLAB-URL; esto garantiza que
 * ni siquiera un log de fallo lo imprima.
 */
function sanitizeForLog(text) {
  let out = String(text);
  for (const host of FORBIDDEN_HOSTS) {
    const escaped = host.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    out = out.replaceAll(new RegExp(escaped, "gi"), "[gitlab-host]");
  }
  return out;
}

/** `true` si algún texto contiene el host de la instancia (sin distinguir mayúsculas). */
function containsForbiddenHost(texts) {
  return texts.some((t) => {
    const lower = t.toLowerCase();
    return FORBIDDEN_HOSTS.some((h) => lower.includes(h));
  });
}

/** Aviso de fallo blando: el snapshot commiteado se conserva tal cual. */
function softWarn(file, reason) {
  console.warn(
    `${TAG} ⚠ ${file}: se conserva el snapshot commiteado (${sanitizeForLog(reason)})`,
  );
}

/**
 * Instante actual en ISO-8601 UTC sin milisegundos, el formato de
 * meta.generatedAt en los snapshots (p.ej. "2026-08-26T10:04:00Z").
 */
function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Extrae el JSON-RPC de un cuerpo que puede venir como SSE: si no empieza por
 * "{", se toma la primera línea "data: " y se le quita el prefijo.
 */
function parseJsonRpc(raw) {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error("respuesta sin cuerpo JSON ni línea 'data: ' de SSE");
  }
  return JSON.parse(dataLine.slice("data: ".length));
}

/**
 * POST JSON-RPC al endpoint MCP indicado. Devuelve el texto crudo (para la
 * guardia anti-fuga) y el objeto JSON-RPC ya parseado. fetch nativo y no
 * curl: el token no debe aparecer en la línea de comandos de ningún proceso.
 */
async function postRpc(endpoint, method, params, extraHeaders = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Mcp-Method": method,
      ...extraHeaders,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${endpoint}`);
  }
  return { raw, rpc: parseJsonRpc(raw) };
}

/** params de server/discover, con las tres claves _meta que exige el protocolo. */
function discoverParams() {
  return {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        name: "mcp-jmrp-io-build",
        version: "1.0.0",
      },
    },
  };
}

/** Comparación por bytes (a<b), nunca localeCompare: ICU no es determinista entre máquinas. */
function byteCompare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const isPlainObject = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

/**
 * Valida y proyecta el result de server/discover al contrato del snapshot.
 * Whitelist explícita: serverInfo se aplana desde _meta y pierde `icons`
 * (ya viven en src/data/cards/); resultType se exige "complete" y se
 * descarta (es detalle de transporte). Lanza si la forma no es la esperada
 * (el llamador lo degrada a fallo blando).
 */
function buildDiscoverSnapshot(endpoint, result, generatedAt) {
  if (!isPlainObject(result)) throw new Error("result no es un objeto");
  if (result.resultType !== "complete") {
    throw new Error(
      `resultType ${JSON.stringify(result.resultType)} !== "complete"`,
    );
  }
  const si = result._meta?.["io.modelcontextprotocol/serverInfo"];
  if (
    !isPlainObject(si) ||
    !isNonEmptyString(si.name) ||
    !isNonEmptyString(si.version)
  ) {
    throw new Error("serverInfo sin name/version válidos");
  }
  if (
    !Array.isArray(result.supportedVersions) ||
    result.supportedVersions.some((v) => !isNonEmptyString(v))
  ) {
    throw new Error("supportedVersions no es un array de strings");
  }
  if (!isPlainObject(result.capabilities)) {
    throw new Error("capabilities no es un objeto");
  }

  const serverInfo = { name: si.name };
  if (isNonEmptyString(si.title)) serverInfo.title = si.title;
  if (isNonEmptyString(si.description)) serverInfo.description = si.description;
  serverInfo.version = si.version;
  if (isNonEmptyString(si.websiteUrl)) serverInfo.websiteUrl = si.websiteUrl;

  const snapshot = {
    meta: {
      endpoint,
      method: "server/discover",
      protocolVersion: PROTOCOL_VERSION,
      generatedAt,
    },
    serverInfo,
    supportedVersions: result.supportedVersions,
    // Passthrough literal: la forma de capabilities es la del protocolo y el
    // loader (src/data/surface.ts) solo lee sub-campos opcionales.
    capabilities: result.capabilities,
  };
  if (isNonEmptyString(result.instructions)) {
    snapshot.instructions = result.instructions;
  }
  if (typeof result.ttlMs === "number") snapshot.ttlMs = result.ttlMs;
  if (isNonEmptyString(result.cacheScope))
    snapshot.cacheScope = result.cacheScope;
  return snapshot;
}

/**
 * Valida el manifiesto gitlab://tools y lo reduce al contrato del snapshot:
 * solo las entradas kind==="dynamic_action", con los cinco campos que
 * el buscador necesita, más el recuento por dominio precalculado para el SSR.
 * `sourceVersion` ata el catálogo a la release del discover de la MISMA
 * extracción. Lanza si la forma no cuadra (el llamador lo degrada a blando).
 */
function buildActionsSnapshot(endpoint, result, sourceVersion, generatedAt) {
  if (!isPlainObject(result)) throw new Error("result no es un objeto");
  const content = Array.isArray(result.contents)
    ? result.contents[0]
    : undefined;
  if (
    !isPlainObject(content) ||
    !isNonEmptyString(content.uri) ||
    typeof content.text !== "string"
  ) {
    throw new Error("contents[0] sin uri/text");
  }
  if (
    typeof result.ttlMs !== "number" ||
    !isNonEmptyString(result.cacheScope)
  ) {
    throw new Error("envoltorio sin ttlMs/cacheScope");
  }
  const manifest = JSON.parse(content.text);
  if (
    !isNonEmptyString(manifest.surface) ||
    !isNonEmptyString(manifest.uri_template)
  ) {
    throw new Error("manifiesto sin surface/uri_template");
  }
  if (
    !Number.isSafeInteger(manifest.entry_count) ||
    !Array.isArray(manifest.entries)
  ) {
    throw new TypeError("manifiesto sin entry_count/entries válidos");
  }
  if (manifest.entry_count !== manifest.entries.length) {
    throw new Error(
      `entry_count ${manifest.entry_count} !== entries.length ${manifest.entries.length}`,
    );
  }
  if (!Array.isArray(manifest.visible_tools)) {
    throw new TypeError("manifiesto sin visible_tools");
  }

  const seenIds = new Set();
  for (const entry of manifest.entries) {
    if (!isPlainObject(entry)) throw new Error("entrada que no es un objeto");
    if (entry.kind !== "dynamic_action" && entry.kind !== "visible_tool") {
      throw new Error(`kind desconocido ${JSON.stringify(entry.kind)}`);
    }
    if (!isNonEmptyString(entry.id) || seenIds.has(entry.id)) {
      throw new Error(`id ausente o duplicado ${JSON.stringify(entry.id)}`);
    }
    seenIds.add(entry.id);
    if (entry.kind === "dynamic_action" && (
        !isNonEmptyString(entry.title) ||
        !isNonEmptyString(entry.domain) ||
        typeof entry.destructive !== "boolean" ||
        typeof entry.read_only !== "boolean"
      )) {
        throw new Error(`entrada ${entry.id} con campos mal tipados`);
      }
  }
  for (const tool of manifest.visible_tools) {
    if (
      !isPlainObject(tool) ||
      !isNonEmptyString(tool.name) ||
      !isNonEmptyString(tool.title) ||
      typeof tool.destructive !== "boolean" ||
      typeof tool.read_only !== "boolean"
    ) {
      throw new Error("visible_tools con forma inesperada");
    }
  }

  // Proyección: campos verbatim upstream (snake_case read_only incluido — es
  // una proyección, no una transformación) y orden estable por id.
  const entries = manifest.entries
    .filter((e) => e.kind === "dynamic_action")
    .map((e) => ({
      id: e.id,
      title: e.title,
      domain: e.domain,
      destructive: e.destructive,
      read_only: e.read_only,
    }))
    .sort((a, b) => byteCompare(a.id, b.id));

  // Orden alfabético por dominio: un cambio de count es un diff de 1 línea.
  // El SSR reordena por count al pintar. Nombres *Count explícitos para que
  // nadie los lea como booleanos junto a entries.
  const byDomain = new Map();
  for (const e of entries) {
    const d = byDomain.get(e.domain) ?? {
      domain: e.domain,
      count: 0,
      destructiveCount: 0,
      readOnlyCount: 0,
    };
    d.count += 1;
    if (e.destructive) d.destructiveCount += 1;
    if (e.read_only) d.readOnlyCount += 1;
    byDomain.set(e.domain, d);
  }
  const domains = [...byDomain.values()].sort((a, b) =>
    byteCompare(a.domain, b.domain),
  );

  // visible_tools preserva las herramientas visibles que entries excluye:
  // entryCount (procedencia upstream: acciones + entradas visible_tool) y
  // actionCount (la cifra publicable, solo acciones) cuadran gracias a esta
  // lista, sin depender de recuentos concretos de ninguna release.
  const visibleTools = manifest.visible_tools
    .map((t) => ({
      name: t.name,
      title: t.title,
      destructive: t.destructive,
      read_only: t.read_only,
    }))
    .sort((a, b) => byteCompare(a.name, b.name));

  return {
    meta: {
      endpoint,
      resourceUri: content.uri,
      surface: manifest.surface,
      // El UI deriva cada detail_uri de esta plantilla, no lo hardcodea.
      uriTemplate: manifest.uri_template,
      sourceVersion,
      entryCount: manifest.entry_count,
      actionCount: entries.length,
      visibleTools,
      ttlMs: result.ttlMs,
      cacheScope: result.cacheScope,
      generatedAt,
    },
    domains,
    entries,
  };
}

/** Serialización canónica de un snapshot (pasa `prettier --check` tal cual). */
function serialize(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/**
 * Escribe el snapshot solo si difiere del existente IGNORANDO
 * meta.generatedAt: así un build sin novedad no ensucia el árbol de git y
 * generatedAt documenta el último cambio real. Escritura atómica: temporal
 * en el MISMO directorio (mismo filesystem ⇒ rename atómico) y rename final.
 */
function writeIfChanged(target, snapshot) {
  const body = serialize(snapshot);
  let existing;
  try {
    existing = fs.readFileSync(target, "utf8");
  } catch {
    existing = undefined;
  }
  if (existing !== undefined) {
    try {
      const a = JSON.parse(existing);
      const b = JSON.parse(body);
      if (isPlainObject(a.meta)) delete a.meta.generatedAt;
      if (isPlainObject(b.meta)) delete b.meta.generatedAt;
      if (JSON.stringify(a) === JSON.stringify(b)) {
        console.log(`${TAG} = ${path.basename(target)}: sin cambios`);
        return;
      }
    } catch {
      // Existente corrupto: se sobrescribe con el candidato válido.
    }
  }
  const tmp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.tmp`,
  );
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, target);
  console.log(`${TAG} ✓ ${path.basename(target)}: actualizado`);
}

/**
 * Orquesta las tres extracciones. Cada una degrada a fallo blando por
 * separado (como sync-server-cards.sh: un MCP caído no bloquea al otro);
 * solo la guardia anti-fuga es fallo duro, y corre ANTES de escribir nada.
 */
async function main() {
  fs.mkdirSync(SURFACE_DIR, { recursive: true });
  const generatedAt = nowIso();
  // Candidatos acumulados: nada se escribe hasta pasar la guardia anti-fuga.
  const pending = [];

  // libgen — server/discover, sin autenticación.
  try {
    const endpoint = `${BASE}/libgen/mcp`;
    const { raw, rpc } = await postRpc(
      endpoint,
      "server/discover",
      discoverParams(),
    );
    if (rpc.error)
      throw new Error(`JSON-RPC ${rpc.error.code}: ${rpc.error.message}`);
    pending.push({
      target: path.join(SURFACE_DIR, "libgen-discover.json"),
      snapshot: buildDiscoverSnapshot(endpoint, rpc.result, generatedAt),
      raws: [raw],
    });
  } catch (error) {
    softWarn("libgen-discover.json", error.message);
  }

  // gitlab — discover y manifiesto exigen token Y cabecera GITLAB-URL
  // (sin ella el edge sirve la superficie de su instancia por defecto, no
  // la documentada), y sin GITLAB_URL la guardia anti-fuga queda además
  // desarmada: no se escribe nada derivado de gitlab sin poder
  // inspeccionarlo antes. En CI sin secretos se conservan ambos snapshots:
  // esa ES la semántica de respaldo.
  if (!GITLAB_TOKEN || !GITLAB_URL) {
    const reason = GITLAB_TOKEN
      ? "falta GITLAB_URL y sin ella la guardia anti-fuga no puede armarse"
      : "falta GITLAB_TOKEN";
    softWarn("gitlab-discover.json", reason);
    softWarn("gitlab-actions.json", reason);
  } else {
    const endpoint = `${BASE}/gitlab/mcp`;
    let sourceVersion;
    try {
      const { raw, rpc } = await postRpc(
        endpoint,
        "server/discover",
        discoverParams(),
        {
          "PRIVATE-TOKEN": GITLAB_TOKEN,
          "GITLAB-URL": GITLAB_URL,
        },
      );
      if (rpc.error)
        throw new Error(`JSON-RPC ${rpc.error.code}: ${rpc.error.message}`);
      const snapshot = buildDiscoverSnapshot(endpoint, rpc.result, generatedAt);
      sourceVersion = snapshot.serverInfo.version;
      pending.push({
        target: path.join(SURFACE_DIR, "gitlab-discover.json"),
        snapshot,
        raws: [raw],
      });
    } catch (error) {
      softWarn("gitlab-discover.json", error.message);
    }

    // El manifiesto necesita el sourceVersion del discover de ESTA misma
    // pasada (ata catálogo a release): sin discover no se refresca.
    if (sourceVersion) {
      try {
        // resources/read exige, además del token, params._meta con las
        // mismas tres claves que discover y la cabecera Mcp-Name con la URI
        // del recurso (sin ella el edge responde -32020, verificado).
        const uri = "gitlab://tools";
        const { raw, rpc } = await postRpc(
          endpoint,
          "resources/read",
          { uri, _meta: discoverParams()._meta },
          {
            "PRIVATE-TOKEN": GITLAB_TOKEN,
            "GITLAB-URL": GITLAB_URL,
            "Mcp-Name": uri,
          },
        );
        if (rpc.error) {
          // -32601 = el método/recurso no existe en esta release: no es un
          // error, simplemente aún no hay nada nuevo que snapshotear.
          if (rpc.error.code === -32_601) {
            console.log(
              `${TAG} = gitlab-actions.json: resources/read no disponible (-32601)`,
            );
          } else {
            throw new Error(`JSON-RPC ${rpc.error.code}: ${rpc.error.message}`);
          }
        } else {
          pending.push({
            target: path.join(SURFACE_DIR, "gitlab-actions.json"),
            snapshot: buildActionsSnapshot(
              endpoint,
              rpc.result,
              sourceVersion,
              generatedAt,
            ),
            raws: [raw],
          });
        }
      } catch (error) {
        softWarn("gitlab-actions.json", error.message);
      }
    } else {
      softWarn(
        "gitlab-actions.json",
        "sin discover del que atar sourceVersion",
      );
    }
  }

  // GUARDIA ANTI-FUGA — fallo DURO antes de escribir un solo fichero. Se
  // inspecciona el texto CRUDO descargado y cada snapshot ya serializado. El
  // mensaje es genérico a propósito: imprimir el host aquí sería la fuga.
  const inspectable = pending.flatMap((p) => [
    ...p.raws,
    serialize(p.snapshot),
  ]);
  if (containsForbiddenHost(inspectable)) {
    console.error(
      `${TAG} ✗ una respuesta o snapshot contiene el host de GITLAB_URL; extracción abortada sin escribir nada`,
    );
    process.exit(1);
  }

  for (const p of pending) {
    writeIfChanged(p.target, p.snapshot);
  }
}

await main();
