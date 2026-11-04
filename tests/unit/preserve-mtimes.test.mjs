/**
 * The validators of an unchanged file survive a deploy, and those of a changed
 * one do not. The second half is the one that matters most: a changed file with
 * its old ETag answers 304 to a client holding the stale copy.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { preserveUnchangedMtimes } from "../../scripts/lib/preserve-mtimes.mjs";

const SWAP = fileURLToPath(
  new URL("../../scripts/deploy-swap.mjs", import.meta.url),
);
const OLD = new Date("2026-01-02T03:04:05.000Z");
const NEW = new Date("2026-06-07T08:09:10.000Z");

/**
 * Writes a file with a known mtime, creating its directory.
 * @param {string} root Tree the file belongs to.
 * @param {string} rel Path inside the tree.
 * @param {string} content Its bytes.
 * @param {Date} mtime Modification time to give it.
 */
function put(root, rel, content, mtime) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  fs.utimesSync(file, mtime, mtime);
}

/**
 * Reads a file's mtime.
 * @param {string} root Tree the file belongs to.
 * @param {string} rel Path inside the tree.
 * @returns {number} Milliseconds since the epoch.
 */
function mtimeOf(root, rel) {
  return fs.statSync(path.join(root, rel)).mtimeMs;
}

/**
 * Creates a throwaway directory, removed when the test ends.
 * @param {import("node:test").TestContext} t The running test.
 * @returns {string} Its path.
 */
function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preserve-mtimes-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("an identical file keeps its mtime, at any depth and in a dot directory", (t) => {
  const root = scratch(t);
  const [active, fresh] = [path.join(root, "a"), path.join(root, "b")];
  for (const rel of [
    "llms.txt",
    "llms.txt.br",
    "_astro/fonts/x.woff2",
    ".well-known/security.txt",
  ]) {
    put(active, rel, `bytes of ${rel}`, OLD);
    put(fresh, rel, `bytes of ${rel}`, NEW);
  }

  assert.deepEqual(preserveUnchangedMtimes(active, fresh), {
    files: 4,
    restored: 4,
  });
  for (const rel of ["llms.txt", "llms.txt.br", "_astro/fonts/x.woff2"]) {
    assert.equal(mtimeOf(fresh, rel), OLD.getTime(), rel);
  }
  assert.equal(mtimeOf(fresh, ".well-known/security.txt"), OLD.getTime());
});

test("a changed file keeps its new mtime, also when the size is the same", (t) => {
  const root = scratch(t);
  const [active, fresh] = [path.join(root, "a"), path.join(root, "b")];
  put(active, "same-size.txt", "aaaa", OLD);
  put(fresh, "same-size.txt", "bbbb", NEW);
  put(active, "other-size.txt", "aaaa", OLD);
  put(fresh, "other-size.txt", "aaaaa", NEW);

  assert.equal(preserveUnchangedMtimes(active, fresh).restored, 0);
  assert.equal(mtimeOf(fresh, "same-size.txt"), NEW.getTime());
  assert.equal(mtimeOf(fresh, "other-size.txt"), NEW.getTime());
});

test("a file on one side only is left alone, and the live tree is never written", (t) => {
  const root = scratch(t);
  const [active, fresh] = [path.join(root, "a"), path.join(root, "b")];
  put(active, "kept.txt", "same", OLD);
  put(fresh, "kept.txt", "same", NEW);
  put(fresh, "added.txt", "new page", NEW);
  put(active, "retired.txt", "old page", OLD);

  preserveUnchangedMtimes(active, fresh);

  assert.equal(mtimeOf(fresh, "added.txt"), NEW.getTime());
  assert.ok(!fs.existsSync(path.join(fresh, "retired.txt")));
  assert.equal(mtimeOf(active, "kept.txt"), OLD.getTime());
  assert.equal(mtimeOf(active, "retired.txt"), OLD.getTime());
});

test("a symlink is neither followed nor touched", (t) => {
  const root = scratch(t);
  const [active, fresh] = [path.join(root, "a"), path.join(root, "b")];
  put(root, "outside.txt", "same", NEW);
  put(active, "link.txt", "same", OLD);
  fs.mkdirSync(fresh, { recursive: true });
  fs.symlinkSync(path.join(root, "outside.txt"), path.join(fresh, "link.txt"));

  assert.deepEqual(preserveUnchangedMtimes(active, fresh), {
    files: 0,
    restored: 0,
  });
  assert.equal(mtimeOf(root, "outside.txt"), NEW.getTime());
});

test("deploy-swap keeps the validators before it retargets dist", (t) => {
  const root = scratch(t);
  const blue = path.join(root, "builds/blue");
  const green = path.join(root, "builds/green");
  put(blue, "index.html", "same page", OLD);
  put(blue, "changed.txt", "before", OLD);
  put(green, "index.html", "same page", NEW);
  put(green, "changed.txt", "after!", NEW);
  fs.symlinkSync("builds/blue", path.join(root, "dist"));

  execFileSync(process.execPath, [SWAP, "swap", "builds/green"], {
    cwd: root,
    stdio: "pipe",
  });

  assert.equal(fs.readlinkSync(path.join(root, "dist")), "builds/green");
  assert.equal(mtimeOf(green, "index.html"), OLD.getTime());
  assert.equal(mtimeOf(green, "changed.txt"), NEW.getTime());
});

test("deploy-swap still goes live on a first deploy, with nothing to compare", (t) => {
  const root = scratch(t);
  const green = path.join(root, "builds/green");
  put(green, "index.html", "first page", NEW);

  execFileSync(process.execPath, [SWAP, "swap", "builds/green"], {
    cwd: root,
    stdio: "pipe",
  });

  assert.equal(fs.readlinkSync(path.join(root, "dist")), "builds/green");
  assert.equal(mtimeOf(green, "index.html"), NEW.getTime());
});

test("deploy-swap compares against a legacy real dist before migrating it", (t) => {
  const root = scratch(t);
  const green = path.join(root, "builds/green");
  put(path.join(root, "dist"), "index.html", "same page", OLD);
  put(green, "index.html", "same page", NEW);

  execFileSync(process.execPath, [SWAP, "swap", "builds/green"], {
    cwd: root,
    stdio: "pipe",
  });

  assert.equal(fs.readlinkSync(path.join(root, "dist")), "builds/green");
  assert.equal(mtimeOf(green, "index.html"), OLD.getTime());
});

test("deploy-swap goes live even if the validators cannot be kept", (t) => {
  const root = scratch(t);
  const green = path.join(root, "builds/green");
  put(green, "index.html", "same page", NEW);
  // A target that cannot be read: looking inside a symlink loop fails with
  // ELOOP, which no permission bit can fake for a test running as root.
  fs.symlinkSync("loop", path.join(root, "builds/loop"));
  fs.symlinkSync("builds/loop", path.join(root, "dist"));

  const { status, stderr } = spawnSync(
    process.execPath,
    [SWAP, "swap", "builds/green"],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(status, 0, stderr);
  assert.match(stderr, /could not keep the validators/);
  assert.equal(fs.readlinkSync(path.join(root, "dist")), "builds/green");
});
