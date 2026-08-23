#!/bin/bash
# =============================================================================
# Refresca el snapshot commiteado de los Server Cards SEP-1649
# (src/data/cards/<id>.json), que cada MCP publica en
# /.well-known/mcp/server-card.json.
#
# La sección /servers/ del sitio (spec: .superpowers/sdd/servers-section-spec.md)
# se genera en build a partir de estos ficheros — no en vivo. Decidido así
# porque el card solo cambia cuando hay release, y este mismo repo ya tiene
# un timer horario
# (mcp-update.timer) que lo detecta: generar HTML en vivo desde un card de
# 41 KB en Lua era otra categoría de riesgo (escapado, i18n, un fallo tumba la
# página) por un caso que ya cubre un snapshot estático.
#
# Los ficheros se formatean con `jq -S` (claves ordenadas, indentación fija de
# jq): así el diff de `git` documenta lo que cambió DE VERDAD en la API entre
# dos releases, en vez de una reordenación de claves sin significado.
#
# Escritura atómica por fichero: se descarga y valida en un temporal del MISMO
# directorio (mismo filesystem, para que el `mv` final sea un rename atómico)
# y solo si pasa la validación sustituye al publicado. Un card que falla NO
# se toca; los demás sí se actualizan — cada MCP tiene su propio ciclo de
# release y no hay motivo para que uno bloquee al otro.
#
# Uso:
#   bash scripts/sync-server-cards.sh           # todos los cards
#   bash scripts/sync-server-cards.sh libgen    # solo uno
#
# Lo llama ops/scripts/mcp_update.sh tras un despliegue que sí cambió alguna
# versión — nunca en un ciclo horario sin novedad ("Nada que hacer").
#
# PARA AÑADIR UN MCP NUEVO: una línea en CARDS (abajo). El módulo TypeScript
# que consume estos ficheros (src/data/server-cards.ts) también necesita su
# propio import — ver el comentario de cabecera de ese fichero.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CARDS_DIR="$REPO_ROOT/src/data/cards"

# <id>|<URL del Server Card SEP-1649>
CARDS=(
  "libgen|https://mcp.jmrp.io/libgen/.well-known/mcp/server-card.json"
  "gitlab|https://mcp.jmrp.io/gitlab/.well-known/mcp/server-card.json"
)

# `return 0` explícito: sin él la función devuelve el estado de `echo`, que
# falla si su salida está cerrada (por ejemplo con el log redirigido a una
# tubería cortada), y `sync_one` lo interpretaría como card fallida.
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; return 0; }

# Descarga y valida UN card; solo si todo sale bien sustituye el publicado.
#
# @param 1 id del servidor (p.ej. "libgen")
# @param 2 URL del server-card.json
sync_one() {
  local id=$1 url=$2
  local target="$CARDS_DIR/$id.json"
  local tmp
  tmp=$(mktemp "$CARDS_DIR/.$id.XXXXXX.json") || {
    log "  ERROR $id: no se pudo crear un temporal en $CARDS_DIR"
    return 1
  }
  local raw="$tmp.raw"
  local http_code
  http_code=$(curl -sS --max-time 30 -o "$raw" -w '%{http_code}' "$url")
  local curl_status=$?

  if [[ "$curl_status" -ne 0 ]]; then
    log "  ERROR $id: curl falló (código $curl_status) contra $url"
    rm -f "$tmp" "$raw"
    return 1
  fi
  if [[ "$http_code" != "200" ]]; then
    log "  ERROR $id: HTTP $http_code en $url"
    rm -f "$tmp" "$raw"
    return 1
  fi

  # jq -S: mismo orden de claves siempre e indentación fija (2 espacios, su
  # valor por defecto). Si el cuerpo no es JSON válido, jq falla y no se
  # escribe nada — nunca un fichero corrupto a medio parsear.
  if ! jq -S . "$raw" >"$tmp" 2>/dev/null; then
    log "  ERROR $id: la respuesta de $url no es JSON válido"
    rm -f "$tmp" "$raw"
    return 1
  fi
  rm -f "$raw"

  # Comprobación mínima de forma: un 200 sin serverInfo.name/version ni
  # ningún catálogo no es un Server Card, es un error disfrazado de éxito
  # (una página de mantenimiento, un balanceador respondiendo su propio
  # JSON). Esto es lo MISMO mínimo que exige en build
  # `validateServerCardDocument` en src/data/server-cards.ts — comprobarlo
  # aquí también no es redundante: si falla aquí, el card roto ni siquiera
  # llega a commitearse, y el error señala directamente al fetch que lo
  # produjo en vez de aparecer más tarde como un fallo de build sin URL a
  # mano. Las cuatro familias (tools/prompts/resources/resourceTemplates)
  # deben ser arrays cuando el card las incluye — `?` en cada acceso evita
  # que jq falle si el campo no existe, en vez de tratarlo como error de
  # forma.
  if ! jq -e '
        (.serverInfo?.name? | type == "string" and length > 0) and
        (.serverInfo?.version? | type == "string" and length > 0) and
        ([.tools?, .prompts?, .resources?] | any(. != null)) and
        ([.tools?, .prompts?, .resources?, .resourceTemplates?]
          | all(. == null or type == "array"))
      ' "$tmp" >/dev/null 2>&1; then
    log "  ERROR $id: $url no tiene forma de Server Card válida (falta serverInfo.name/version, no hay ningún catálogo, o alguna familia no es un array)"
    rm -f "$tmp"
    return 1
  fi

  chmod 644 "$tmp"
  if ! mv -f "$tmp" "$target"; then
    log "  ERROR $id: no se pudo sustituir $target"
    rm -f "$tmp"
    return 1
  fi
  log "  OK $id: $(jq -r '.serverInfo.version' "$target") -> ${target#"$REPO_ROOT"/}"
  return 0
}

main() {
  mkdir -p "$CARDS_DIR"
  local only="${1:-}"
  local failed="" matched=0

  for entry in "${CARDS[@]}"; do
    IFS='|' read -r id url <<<"$entry"
    if [[ -n "$only" && "$only" != "$id" ]]; then continue; fi
    matched=$((matched + 1))
    sync_one "$id" "$url" || failed+="$id "
  done

  if [[ "$matched" -eq 0 ]]; then
    log "ERROR: '$only' no es un id de card conocido (ver CARDS en este script)"
    exit 2
  fi

  if [[ -n "$failed" ]]; then
    log "Server Cards con error: $failed(el resto sí se actualizó)"
    exit 1
  fi

  # Explícito por claridad, no porque arreglara nada: comprobado que un `if`
  # cuya condición no se cumple ya devuelve 0, así que el camino de éxito
  # salía bien igualmente. Se deja escrito para que el contrato de la función
  # se lea sin tener que recordar esa regla de bash.
  return 0
}

main "$@"
