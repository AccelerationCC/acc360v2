// ── THE BRANCH LISTER ──────────────────────────────────────────────────────
//
// DUPLICATE of client-newsroom/src/lib/stranded-branches.ts, which is the
// source of truth — same discipline as Wordmark.tsx, BoundaryTransition.tsx and
// lib/capabilities.ts. Separate repos, separate Vercel projects, no workspace:
// change both in the same commit or the two guards drift.
//
// The point of it being HERE and not only there: this repo is where the failure
// actually happened. A guard that lives in one repo and reaches into the other
// on demand makes the second repo an afterthought, which is the shape of the
// original problem.
//
// Finds work that exists only on a branch: commits that are not on the default
// branch and have no open pull request carrying them there.
//
// WHY THIS EXISTS
//
// On 2026-08-28 four ACC360 commits — the wordmark, the dark palette, the
// boundary interstitial and Settings — were described as delivered while
// sitting on `phase2-ui-copy` with no PR open. Nothing was lying: each had been
// built, verified and reported at the time. What was missing was any surface
// that says "this is still only on a branch", so the branch simply stopped
// being mentioned and the work read as shipped.
//
// That failure is silent by construction. A branch with no PR appears nowhere:
// not in the PR list, not in the checks, not on the default branch. The only
// place it shows up is a `git branch -r` that nobody runs.
//
// WHAT COUNTS AS STRANDED
//
// Ahead of the default branch, and no OPEN pull request whose head is that
// branch. Both halves are load-bearing:
//
//   ahead > 0        a branch fully merged (or behind and never touched) is
//                    not stranded, it is finished. Ahead is what makes it
//                    unshipped work rather than a leftover ref.
//   no open PR       a branch WITH an open PR is visible — it is in the PR
//                    list, it runs checks, it gets review. That is the whole
//                    point of the distinction: this guard is for work that has
//                    no surface at all, not for work waiting its turn.
//
// A CLOSED or MERGED pull request does not rescue a branch. A PR closed
// without merging is the exact case where commits are most likely to be
// forgotten, so those branches stay on the list.

/** One branch as the host reports it. Shaped to what `gh api` returns so the
 *  caller does no reshaping beyond picking fields. */
export interface BranchInput {
  name: string;
  /** Commits on this branch that are not on the default branch. The API's
   *  `compare` endpoint calls this `ahead_by`. */
  aheadBy: number;
  /** ISO 8601. The tip commit's author date, used only for ordering and for
   *  saying how long something has been sitting. */
  lastCommitISO: string;
  lastCommitAuthor: string;
  lastCommitSubject: string;
}

/** Open pull requests, reduced to the branch each one carries. */
export interface PullRequestInput {
  number: number;
  headRefName: string;
  /** Anything other than "OPEN" does not protect a branch — see the note above. */
  state: string;
}

export interface StrandedBranch extends BranchInput {
  /** Whole days between the tip commit and `now`, floored. */
  ageDays: number;
}

export interface FindStrandedOptions {
  branches: BranchInput[];
  pullRequests: PullRequestInput[];
  defaultBranch: string;
  /** Injected so the result is deterministic in tests rather than depending on
   *  the wall clock. */
  now: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the stranded branches, oldest tip commit first — so the thing that
 * has been invisible longest is read first, which is also the thing most
 * likely to have been forgotten.
 */
export function findStrandedBranches({
  branches,
  pullRequests,
  defaultBranch,
  now,
}: FindStrandedOptions): StrandedBranch[] {
  const openPrBranches = new Set(
    pullRequests.filter((pr) => pr.state === "OPEN").map((pr) => pr.headRefName),
  );

  return branches
    .filter((b) => b.name !== defaultBranch)
    .filter((b) => b.aheadBy > 0)
    .filter((b) => !openPrBranches.has(b.name))
    .map((b) => ({
      ...b,
      ageDays: Math.max(0, Math.floor((now.getTime() - Date.parse(b.lastCommitISO)) / MS_PER_DAY)),
    }))
    .sort((a, b) => Date.parse(a.lastCommitISO) - Date.parse(b.lastCommitISO));
}

/**
 * Renders the report. Plain text on purpose: the same string is readable in a
 * terminal, in an issue body and in a CI log, and nothing about it needs a
 * renderer to be understood.
 *
 * Returns null when there is nothing stranded, so a caller can distinguish
 * "clean" from "a report that happens to be empty" without parsing the text.
 */
export function formatStrandedReport(stranded: StrandedBranch[], repo: string): string | null {
  if (stranded.length === 0) return null;

  const lines = [
    `${stranded.length} branch${stranded.length === 1 ? "" : "es"} on ${repo} ` +
      `${stranded.length === 1 ? "carries" : "carry"} commits that are on no open PR:`,
    "",
  ];

  for (const b of stranded) {
    const commits = `${b.aheadBy} commit${b.aheadBy === 1 ? "" : "s"}`;
    const age = b.ageDays === 0 ? "today" : `${b.ageDays}d ago`;
    lines.push(`  ${b.name}`);
    lines.push(`    ${commits} ahead · last touched ${age} by ${b.lastCommitAuthor}`);
    lines.push(`    ${b.lastCommitSubject}`);
    lines.push("");
  }

  lines.push(
    "Each of these is either work to finish, work to merge, or a branch to delete.",
    "Being on this list is not a defect — having been on it for weeks is.",
  );
  return lines.join("\n");
}
