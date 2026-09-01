#!/bin/bash
# =============================================================================
# Refreshes the committed snapshot of the instance/egress topology
# (src/data/topology.json): which exit node each instance of each MCP server
# leaves through, and that node's country.
#
# /internals/ draws its request-path figure from this file and states the
# egress split in prose. Until 2026-09-01 those facts lived in a hand-written
# TypeScript literal "verified against the live upstream" on a date — and by
# the time anyone looked again they were wrong: the census had changed, a
# third exit node had been added, and the page kept describing two. The same
# thing had already happened to the Server Cards, and the fix is the same:
# a committed JSON refreshed from the source of truth by the deploy path
# (sync-server-cards.sh), not a literal somebody has to remember.
#
# The source of truth is the egress census in ops/ (gitignored, never in CI):
# ops/egress/egress-dump.sh prints it as JSON. This script runs on the server
# where ops/ exists, writes the JSON, and the result is committed like any
# other data file — so a CI build never needs ops/ at all.
#
# What is published is deliberately small: per instance, the exit node's id
# and its country. No endpoints, no keys, no ports, no host names — the page
# never shows those and the spec forbids ports outright.
#
# Usage:
#   bash scripts/sync-topology.sh
#
# Called by ops/scripts/mcp_update.sh after a deployment, next to the Server
# Cards refresh. Safe to run by hand any time.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$REPO_ROOT/src/data/topology.json"
DUMP="$REPO_ROOT/ops/egress/egress-dump.sh"

# Country per exit node. The census does not carry it — it is not an
# operational fact, only a descriptive one — and a page claiming "Spain or the
# United Kingdom" must not guess. An id missing here fails the sync loudly
# rather than shipping a node with no country.
declare -A COUNTRY=(
  [uk]=GB
  [es]=ES
  [cam]=ES
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; return 0; }

main() {
  if [[ ! -f "$DUMP" ]]; then
    log "ERROR: $DUMP not found — this script runs on the server that has ops/"
    exit 2
  fi

  local raw
  raw=$(bash "$DUMP" 2>/dev/null) || { log "ERROR: egress-dump.sh failed"; exit 1; }

  # One check per exit id BEFORE writing anything: the JSON below would
  # silently carry `null` for an unmapped country, which is exactly the kind
  # of quiet wrongness this file exists to end.
  local id
  while IFS= read -r id; do
    [[ -n "${COUNTRY[$id]:-}" ]] || {
      log "ERROR: exit node '$id' has no country in COUNTRY (edit this script)"
      exit 1
    }
  done < <(printf '%s' "$raw" | jq -r '.egresses[].id')

  # Instances grouped by server, in census order (which is the upstream
  # order: libgen-1, libgen-2, ...). Each carries its exit id and country.
  local map_json
  map_json=$(for id in "${!COUNTRY[@]}"; do printf '{"%s":"%s"}' "$id" "${COUNTRY[$id]}"; done | jq -s 'add')

  local tmp
  tmp=$(mktemp "$(dirname "$TARGET")/.topology.XXXXXX.json") || {
    log "ERROR: could not create a temporary file next to $TARGET"; exit 1
  }

  if ! printf '%s' "$raw" | jq -S --argjson country "$map_json" '
        .peers
        | map({
            server: (.replica | sub("-[0-9]+$"; "")),
            replica: .replica,
            egress: .egress,
            egressCountry: $country[.egress]
          })
        | group_by(.server)
        | map({ key: .[0].server, value: map({ replica, egress, egressCountry }) })
        | from_entries
      ' > "$tmp" 2>/dev/null; then
    log "ERROR: could not compose topology.json from the census"
    rm -f "$tmp"; exit 1
  fi

  # Shape check, the same minimum src/data/topology.ts demands at build time:
  # both servers present, every instance with a non-empty egress and a
  # two-letter country.
  if ! jq -e '
        (.libgen | type == "array" and length > 0) and
        (.gitlab | type == "array" and length > 0) and
        ([.[][]] | all(
          (.egress | type == "string" and length > 0) and
          (.egressCountry | type == "string" and test("^[A-Z]{2}$"))
        ))
      ' "$tmp" >/dev/null 2>&1; then
    log "ERROR: the generated topology does not have the expected shape"
    rm -f "$tmp"; exit 1
  fi

  chmod 644 "$tmp"
  mv -f "$tmp" "$TARGET" || { log "ERROR: could not replace $TARGET"; rm -f "$tmp"; exit 1; }
  log "OK topology: $(jq -c 'to_entries | map("\(.key)=\(.value | map(.egress) | join(","))") | join(" ")' "$TARGET") -> ${TARGET#"$REPO_ROOT"/}"
  return 0
}

main "$@"
