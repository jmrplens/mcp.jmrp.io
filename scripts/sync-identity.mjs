#!/usr/bin/env node
/**
 * Writes the local snapshot of the canonical `#person` entity.
 *
 * The build downloads the live document (see src/lib/identity.ts) and rewrites
 * this snapshot itself whenever the download succeeds; the snapshot is only
 * the fallback for a build with no network. It is git-ignored since
 * 2026-10-22, so this script is just a way to write it without building, for
 * example before working offline.
 *
 * Usage:
 *   node scripts/sync-identity.mjs   # writes the snapshot
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const SOURCE =
  "https://raw.githubusercontent.com/jmrplens/jmrp.io/main/public/identity/person.jsonld";
const TARGET = path.join(process.cwd(), "identity", "person.snapshot.json");

const response = await fetch(SOURCE, { signal: AbortSignal.timeout(15_000) });
if (!response.ok) {
  console.error(`✗ Could not download ${SOURCE} — HTTP ${response.status}`);
  process.exit(1);
}
const latest = `${JSON.stringify(await response.json(), null, 2)}\n`;

mkdirSync(path.dirname(TARGET), { recursive: true });
writeFileSync(TARGET, latest);
console.log("✓ identity/person.snapshot.json refreshed");
