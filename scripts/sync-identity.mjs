#!/usr/bin/env node
/**
 * Refreshes the committed snapshot of the canonical `#person` entity.
 *
 * The build downloads the live document (see src/lib/identity.ts); this
 * snapshot is only the fallback for when there is no network. It is refreshed
 * deliberately — with this script and in its own commit — so the identity this
 * site would publish with no network is visible in review, rather than staying
 * frozen at whatever it was the day the file was created.
 *
 * The same script as in the repos' other documentation sites.
 *
 * Usage:
 *   node scripts/sync-identity.mjs           # writes the snapshot
 *   node scripts/sync-identity.mjs --check   # fails when it is stale (CI)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

if (process.argv.includes("--check")) {
  let committed;
  try {
    committed = readFileSync(TARGET, "utf8");
  } catch {
    console.error(
      "✗ identity/person.snapshot.json is missing — create it with: pnpm run identity:sync",
    );
    process.exit(1);
  }
  if (committed !== latest) {
    console.error(
      "✗ identity/person.snapshot.json is out of date.\n" +
        "  Refresh it with: pnpm run identity:sync",
    );
    process.exit(1);
  }
  console.log("✓ The snapshot matches the canonical document.");
} else {
  mkdirSync(path.dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, latest);
  console.log("✓ identity/person.snapshot.json refreshed");
}
