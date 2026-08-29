#!/bin/bash
# =============================================================================
# Refreshes the committed snapshot of the SEP-1649 Server Cards
# (src/data/cards/<id>.json), which each MCP publishes at
# /.well-known/mcp/server-card.json.
#
# The site's /servers/ section (spec: .superpowers/sdd/servers-section-spec.md)
# is generated at build time from these files — not live. It was decided that
# way because the card only changes on a release, and this same repo already
# has an hourly timer
# (mcp-update.timer) that detects it: generating HTML live from a 41 KB card in
# Lua was a different category of risk (escaping, i18n, one bug takes the page
# down) for a case a static snapshot already covers.
#
# The files are formatted with `jq -S` (sorted keys, jq's fixed indentation):
# that way `git`'s diff documents what REALLY changed in the API between two
# releases, instead of a meaningless key reordering.
#
# Atomic write per file: it is downloaded and validated into a temporary file in
# the SAME directory (the same filesystem, so the final `mv` is an atomic
# rename) and only replaces the published one once it passes validation. A card
# that fails is NOT touched; the others are still updated — each MCP has its own
# release cycle and there is no reason for one to block the other.
#
# Usage:
#   bash scripts/sync-server-cards.sh           # every card
#   bash scripts/sync-server-cards.sh libgen    # just one
#
# It is called by ops/scripts/mcp_update.sh after a deployment that did change
# some version — never on an hourly cycle with no news ("Nothing to do").
#
# TO ADD A NEW MCP: one line in CARDS (below). The TypeScript module that
# consumes these files (src/data/server-cards.ts) also needs its own import —
# see that file's header comment.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CARDS_DIR="$REPO_ROOT/src/data/cards"

# <id>|<SEP-1649 Server Card URL>
CARDS=(
  "libgen|https://mcp.jmrp.io/libgen/.well-known/mcp/server-card.json"
  "gitlab|https://mcp.jmrp.io/gitlab/.well-known/mcp/server-card.json"
)

# An explicit `return 0`: without it the function returns `echo`'s status, which
# fails when its output is closed (for instance with the log redirected to a
# broken pipe), and `sync_one` would read that as a failed card.
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; return 0; }

# Downloads and validates ONE card; only when everything goes well does it
# replace the published one.
#
# @param 1 the server's id (e.g. "libgen")
# @param 2 the server-card.json URL
sync_one() {
  local id=$1 url=$2
  local target="$CARDS_DIR/$id.json"
  local tmp
  tmp=$(mktemp "$CARDS_DIR/.$id.XXXXXX.json") || {
    log "  ERROR $id: could not create a temporary file in $CARDS_DIR"
    return 1
  }
  local raw="$tmp.raw"
  local http_code
  http_code=$(curl -sS --max-time 30 -o "$raw" -w '%{http_code}' "$url")
  local curl_status=$?

  if [[ "$curl_status" -ne 0 ]]; then
    log "  ERROR $id: curl failed (status $curl_status) against $url"
    rm -f "$tmp" "$raw"
    return 1
  fi
  if [[ "$http_code" != "200" ]]; then
    log "  ERROR $id: HTTP $http_code on $url"
    rm -f "$tmp" "$raw"
    return 1
  fi

  # jq -S: the same key order every time and a fixed indentation (2 spaces, its
  # default). If the body is not valid JSON, jq fails and nothing is written —
  # never a corrupt half-parsed file.
  if ! jq -S . "$raw" >"$tmp" 2>/dev/null; then
    log "  ERROR $id: the response from $url is not valid JSON"
    rm -f "$tmp" "$raw"
    return 1
  fi
  rm -f "$raw"

  # Minimal shape check: a 200 with no serverInfo.name/version and no catalog
  # at all is not a Server Card, it is an error dressed up as a success (a
  # maintenance page, a load balancer answering with its own JSON). This is the
  # SAME minimum `validateServerCardDocument` in src/data/server-cards.ts
  # demands at build time — checking it here as well is not redundant: if it
  # fails here, the broken card never even gets committed, and the error points
  # straight at the fetch that produced it instead of surfacing later as a build
  # failure with no URL to hand. The four families
  # (tools/prompts/resources/resourceTemplates) must be arrays when the card
  # includes them — the `?` on each access keeps jq from failing when the field
  # does not exist, rather than treating that as a shape error. Those SAME four
  # families count as a catalog being present: an MCP publishing only resource
  # templates is a legitimate card, and leaving resourceTemplates out of that
  # list rejected it here even though the build accepted it and the page
  # rendered it.
  #
  # `authentication` is required in the exact shape the page consumes
  # (ServerPage.astro reads `.required` and `.schemes.length` with no guard):
  # without this check a card missing the field would not fail here but in page
  # generation, as a TypeError that no longer says which card it came from.
  if ! jq -e '
        (.serverInfo?.name? | type == "string" and length > 0) and
        (.serverInfo?.version? | type == "string" and length > 0) and
        ([.tools?, .prompts?, .resources?, .resourceTemplates?] | any(. != null)) and
        ([.tools?, .prompts?, .resources?, .resourceTemplates?]
          | all(. == null or type == "array")) and
        (.authentication? | type == "object") and
        (.authentication?.required? | type == "boolean") and
        (.authentication?.schemes? | type == "array")
      ' "$tmp" >/dev/null 2>&1; then
    log "  ERROR $id: $url does not have a valid Server Card shape (missing serverInfo.name/version, no catalog at all, some family is not an array, or authentication is not an object with a boolean required and an array of schemes)"
    rm -f "$tmp"
    return 1
  fi

  chmod 644 "$tmp"
  if ! mv -f "$tmp" "$target"; then
    log "  ERROR $id: could not replace $target"
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
    log "ERROR: '$only' is not a known card id (see CARDS in this script)"
    exit 2
  fi

  if [[ -n "$failed" ]]; then
    log "Server Cards with errors: $failed(the rest did update)"
    exit 1
  fi

  # Explicit for clarity, not because it fixed anything: it was checked that an
  # `if` whose condition does not hold already returns 0, so the success path
  # exited fine either way. It is written down so the function's contract reads
  # without having to remember that bash rule.
  return 0
}

main "$@"
