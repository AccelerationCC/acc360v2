#!/usr/bin/env node
// Report branches carrying commits that no open PR is carrying anywhere.
//
// Runs on plain `node` — no tsx, no build step. Node strips the types itself
// (unflagged since 23.6; .nvmrc pins 24), which is why the import below carries
// an explicit .ts extension: tsx resolves an extensionless specifier, bare Node
// ESM does not. tsconfig already sets allowImportingTsExtensions, so tsc is
// happy with it too.
//
// That matters beyond tidiness. ACC360 has no tsx, and adding one there purely
// to run this would be a new dependency in a second repo for a guard that is
// supposed to be cheap.
//
// The npm script passes --disable-warning=MODULE_TYPELESS_PACKAGE_JSON. This
// repo's package.json has no "type": "module", so node warns that it had to
// reparse this file as ESM. The alternative is adding "type": "module" to a
// Next.js app's package.json, which is a real change with real consequences and
// not one worth making to silence a log line in a weekly job — and an unread
// warning in a report is exactly what stops the report being read.
//
//   npm run branches                        # this repo
//   npm run branches -- --repo owner/name   # another one
//   npm run branches -- --json              # machine-readable
//
// The classification lives in lib/stranded-branches.ts and is unit tested
// against fixtures. This file only talks to GitHub, so the rules can be tested
// without a network and this stays small enough to read in one sitting.
//
// Exits 0 when clean and 1 when anything is stranded, so CI can gate on it.
// It reads refs and pull requests and prints. It writes nothing.
//
// Auth comes from `gh`. That matters on this machine: two accounts are logged
// in and `git push` flips the active one through the credential helper, so a
// run that 404s is almost always the wrong account rather than a missing repo.
// The error path below says so rather than making you work it out.

import { execFileSync } from "node:child_process";
import { findStrandedBranches, formatStrandedReport } from "../lib/stranded-branches.ts";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const repoIndex = args.indexOf("--repo");
const repoOverride = repoIndex >= 0 ? args[repoIndex + 1] : undefined;

function run(argv: string[]): string {
  try {
    return execFileSync("gh", argv, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? "");
    if (stderr.includes("Could not resolve to a Repository") || stderr.includes("HTTP 404")) {
      console.error(
        `Cannot see that repository.\n` +
          `If it exists, this is almost certainly the wrong GitHub account.\n` +
          `  gh auth status                 — which account is active\n` +
          `  gh auth switch --user <name>   — change it`,
      );
      process.exit(2);
    }
    throw error;
  }
}

const api = (endpoint: string, jq?: string) =>
  run(jq ? ["api", endpoint, "--jq", jq] : ["api", endpoint]);

const fullName = repoOverride ?? api("repos/{owner}/{repo}", ".full_name").trim();
const defaultBranch = api(`repos/${fullName}`, ".default_branch").trim();

// --paginate, because a repo with more than 30 branches would otherwise be
// silently truncated — and truncation here fails in the one direction this
// guard exists to prevent: quietly hiding work.
const branchNames = run([
  "api",
  "--paginate",
  `repos/${fullName}/branches?per_page=100`,
  "--jq",
  ".[].name",
])
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const pullRequests = JSON.parse(
  run([
    "pr",
    "list",
    "--repo",
    fullName,
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    "number,headRefName,state",
  ]),
) as Array<{ number: number; headRefName: string; state: string }>;

// One compare per branch — the only expensive part, which is why the default
// branch is skipped before the loop rather than inside the classifier.
const branches = [];
for (const name of branchNames) {
  if (name === defaultBranch) continue;
  const compared = JSON.parse(
    api(
      `repos/${fullName}/compare/${encodeURIComponent(defaultBranch)}...${encodeURIComponent(name)}`,
      "{ahead: .ahead_by, date: .commits[-1].commit.author.date, " +
        "author: .commits[-1].commit.author.name, subject: .commits[-1].commit.message}",
    ),
  ) as { ahead: number | null; date: string | null; author: string | null; subject: string | null };

  branches.push({
    name,
    aheadBy: compared.ahead ?? 0,
    // A branch with zero commits ahead has no tip to date; it is filtered out
    // by aheadBy anyway, and the epoch keeps the type honest until it is.
    lastCommitISO: compared.date ?? new Date(0).toISOString(),
    lastCommitAuthor: compared.author ?? "unknown",
    lastCommitSubject: (compared.subject ?? "").split("\n")[0],
  });
}

const stranded = findStrandedBranches({
  branches,
  pullRequests: pullRequests.map((pr) => ({ ...pr, state: pr.state.toUpperCase() })),
  defaultBranch,
  now: new Date(),
});

if (asJson) {
  console.log(JSON.stringify({ repo: fullName, defaultBranch, stranded }, null, 2));
} else {
  console.log(
    formatStrandedReport(stranded, fullName) ??
      `Nothing stranded on ${fullName}. Every branch is either on ${defaultBranch} or on an open PR.`,
  );
}

process.exit(stranded.length > 0 ? 1 : 0);
