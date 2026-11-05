/**
 * Keeps the modification time of every file a deploy did not change.
 *
 * nginx derives both validators of a static file from its mtime: `Last-Modified`
 * directly, and `ETag` as `"<mtime>-<size>"`. Each build writes a fresh tree, so
 * every file got a new mtime and every validator changed on every deploy, whether
 * its bytes did or not: a client revalidating an untouched PDF, font or
 * `llms.txt` got the whole file again instead of a 304.
 *
 * The comparison is by content because nothing cheaper is sound. Same size is
 * not same file, and a false match would hand a changed file the old validators,
 * so clients would keep a stale copy on a 304. The walk covers the `.br` and
 * `.gz` twins too: they are what nginx answers from, with their own mtimes.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Hashes one file's content.
 * @param {string} file Absolute path of the file.
 * @returns {string} Its SHA-256, in hex.
 */
function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

/**
 * Copies the mtime from `activeDir` onto each byte-identical file of `newDir`.
 *
 * Only regular files are considered, on both sides: a symlink is neither
 * followed nor touched. A file that exists on one side only is left alone.
 * @param {string} activeDir The tree currently served.
 * @param {string} newDir The tree about to go live, which is the only one written.
 * @returns {{ files: number, restored: number }} How many files `newDir` holds
 *   and how many of them kept the previous mtime.
 */
export function preserveUnchangedMtimes(activeDir, newDir) {
  let files = 0;
  let restored = 0;
  for (const entry of fs.readdirSync(newDir, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (!entry.isFile()) continue;
    files += 1;
    const fresh = path.join(entry.parentPath, entry.name);
    const previous = path.join(activeDir, path.relative(newDir, fresh));
    const before = fs.lstatSync(previous, { throwIfNoEntry: false });
    if (!before?.isFile()) continue;
    if (before.size !== fs.statSync(fresh).size) continue;
    if (sha256(previous) !== sha256(fresh)) continue;
    fs.utimesSync(fresh, before.atime, before.mtime);
    restored += 1;
  }
  return { files, restored };
}
