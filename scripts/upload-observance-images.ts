#!/usr/bin/env node
// Upload the curated observance images to Vercel Blob and write the returned
// URLs into lib/observances.ts.
//
// Runs on plain `node` — no tsx, no build step, matching scripts/
// stranded-branches.ts. Node strips the types itself (.nvmrc pins 24), which is
// why the relative import below carries an explicit .ts extension: bare Node ESM
// does not resolve an extensionless specifier.
//
//   BLOB_READ_WRITE_TOKEN=... node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     scripts/upload-observance-images.ts [--dry-run]
//
// THE TOKEN IS LOCAL ONLY. BLOB_READ_WRITE_TOKEN is a write credential for a
// store the deployed app has no business touching. It belongs in .env on the
// machine running this script and in NO Vercel environment — if it were set in
// production, any route could write to Blob without anyone deciding it should.
// Nothing in the app imports @vercel/blob; this script is the only consumer.
//
// IDEMPOTENT BY CONSTRUCTION. The blob pathname is derived from the observance
// id, and `addRandomSuffix: false` means the same input filename always produces
// the same pathname and therefore the same URL. Re-running overwrites in place
// rather than accumulating orphans. That is the whole reason the option is set
// explicitly rather than left to its default.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import { getAllObservances } from "../lib/observances.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const IMAGE_DIR = join(ROOT, "observance-images");
const MODULE_PATH = join(ROOT, "lib", "observances.ts");
const ALLOWED = new Set([".jpg", ".jpeg", ".png"]);
const DRY_RUN = process.argv.includes("--dry-run");

function die(heading: string, lines: string[]): never {
  console.error(`\n✗ ${heading}\n`);
  for (const l of lines) console.error(`    ${l}`);
  console.error("");
  process.exit(1);
}

// ── 1. what is on disk ──────────────────────────────────────────────────────

const files = readdirSync(IMAGE_DIR)
  .filter((f) => ALLOWED.has(extname(f).toLowerCase()))
  .sort();

if (files.length === 0) {
  die("No images found in observance-images/", [
    `Looked in: ${IMAGE_DIR}`,
    `Accepted extensions: ${[...ALLOWED].join(", ")}`,
    "See observance-images/README.md for the filename convention.",
  ]);
}

// ── 2. what the module expects ──────────────────────────────────────────────

const rows = getAllObservances().filter((o) => o.active);
const idsInModule = new Set(rows.map((o) => o.id));

const byId = new Map<string, string>();
const unmatched: string[] = [];
const duplicates: string[] = [];

for (const f of files) {
  const id = basename(f, extname(f));
  if (!idsInModule.has(id)) {
    unmatched.push(f);
  } else if (byId.has(id)) {
    duplicates.push(`${byId.get(id)} and ${f} both target "${id}"`);
  } else {
    byId.set(id, f);
  }
}

// FAIL LOUDLY, BOTH DIRECTIONS. A file matching no row is a typo that would
// otherwise upload a blob nothing references. A row with no file is the
// half-done state this whole script exists to make impossible.
if (unmatched.length > 0) {
  die(`${unmatched.length} file(s) match no observance id`, [
    ...unmatched.map((f) => `unmatched: ${f}`),
    "",
    "Valid ids:",
    ...[...idsInModule].sort().map((i) => `  ${i}`),
  ]);
}

if (duplicates.length > 0) {
  die("Two files target the same observance", duplicates);
}

const missing = rows.filter((o) => !byId.has(o.id));
if (missing.length > 0) {
  die(`${missing.length} active observance(s) have no image`, [
    ...missing.map((o) => `missing: ${o.id}.{jpg,png}   (${o.name})`),
    "",
    `${byId.size} of ${rows.length} rows have a file. All of them need one.`,
  ]);
}

console.log(`✓ ${files.length} files matched ${rows.length} active observances, 1:1.`);

if (DRY_RUN) {
  console.log("\n--dry-run: nothing uploaded, nothing written.\n");
  for (const [id, f] of [...byId].sort()) {
    console.log(`    ${f}  ->  observances/${id}${extname(f).toLowerCase()}`);
  }
  process.exit(0);
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  die("BLOB_READ_WRITE_TOKEN is not set", [
    "This is a LOCAL credential. Put it in .env on this machine.",
    "Do NOT add it to any Vercel environment — see the header of this file.",
  ]);
}

// ── 3. upload ───────────────────────────────────────────────────────────────

const uploaded = new Map<string, string>();

for (const [id, file] of [...byId].sort()) {
  const ext = extname(file).toLowerCase();
  const pathname = `observances/${id}${ext}`;
  const body = readFileSync(join(IMAGE_DIR, file));
  const result = await put(pathname, body, {
    access: "public",
    addRandomSuffix: false, // deterministic pathname — this is the idempotency
    allowOverwrite: true, // re-running replaces rather than erroring
  });
  uploaded.set(id, result.url);
  console.log(`    uploaded ${file} -> ${result.url}`);
}

// ── 4. write the URLs into the module ───────────────────────────────────────
//
// Surgical, per row. The whole file is not regenerated: it carries hand-written
// comments and hand-authored searchTerms, and a regenerated file is how those
// get quietly lost.

let source = readFileSync(MODULE_PATH, "utf8");

for (const [id, url] of uploaded) {
  const start = source.indexOf(`{ id: '${id}',`);
  if (start === -1) {
    die(`Could not locate row "${id}" in lib/observances.ts`, [
      "The row exists at runtime but its literal was not found in the source.",
      "The file's formatting may have changed; this script edits it textually.",
    ]);
  }
  const end = source.indexOf("},", start);
  if (end === -1) die(`Row "${id}" is not terminated`, ["Expected a closing '},'."]);

  const block = source.slice(start, end);
  const replaced = block.replace(/imageUrl:\s*(null|'[^']*')/, `imageUrl: '${url}'`);
  if (replaced === block) {
    die(`Row "${id}" has no imageUrl field to write`, [block.trim()]);
  }
  source = source.slice(0, start) + replaced + source.slice(end);
}

writeFileSync(MODULE_PATH, source);
console.log(`✓ wrote ${uploaded.size} URLs into lib/observances.ts`);

// ── 5. refuse to call it done while alt text is missing ─────────────────────
//
// The script never writes imageAlt. Alt text describes what a human chose to
// show; it cannot be derived from a filename, and a generated one is a confident
// description of a picture nobody checked.
//
// So a successful upload still exits NON-ZERO until the alt text is written. The
// URLs above are already saved — this is a to-do list, not a rollback.

// NOT a re-read. `rows` is the module as it was imported at startup, and that
// is deliberate: re-calling getAllObservances() here returns the SAME cached
// module, not the file just written, and naming it `after` would imply a
// freshness it does not have (issues/029). It does not matter, because the only
// field consulted is imageAlt — which this script never writes, so the value
// loaded at import is the current one. On a re-run after a human has filled the
// alt text in, that import carries it and this check passes.
const needAlt = rows.filter((o) => uploaded.has(o.id) && !o.imageAlt);

if (needAlt.length > 0) {
  console.error(`\n✗ ${needAlt.length} row(s) now have an image and no alt text.\n`);
  console.error("    The URLs are written and saved. This is deliberately not");
  console.error("    a success: an image without alt text is a half-shipped row.\n");
  console.error("    Write imageAlt by hand for each, describing the image you chose:\n");
  for (const o of needAlt) console.error(`      ${o.id}  (${o.name})`);
  console.error("");
  process.exit(1);
}

console.log("✓ every uploaded row has alt text. Done.\n");
