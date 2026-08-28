import { describe, expect, it } from "vitest";
import {
  findStrandedBranches,
  formatStrandedReport,
  type BranchInput,
  type PullRequestInput,
} from "./stranded-branches";

// Duplicate of the newsroom's suite; keep them in step.
//
// The branch lister. No network and no git: the classification is a pure
// function over what the host reported, which is the whole reason it was
// written as one.
//
// The fixture is the real 2026-08-28 situation, because that is the case the
// guard exists for — phase2-ui-copy carrying four ACC360 commits with no PR.

const NOW = new Date("2026-08-28T12:00:00Z");

function branch(name: string, over: Partial<BranchInput> = {}): BranchInput {
  return {
    name,
    aheadBy: 1,
    lastCommitISO: "2026-08-27T12:00:00Z",
    lastCommitAuthor: "Yuvraj Singh",
    lastCommitSubject: "a commit",
    ...over,
  };
}

const openPr = (headRefName: string, number = 1): PullRequestInput => ({
  number,
  headRefName,
  state: "OPEN",
});

describe("what counts as stranded", () => {
  it("flags a branch that is ahead and has no PR — the case this exists for", () => {
    const result = findStrandedBranches({
      branches: [branch("phase2-ui-copy", { aheadBy: 4 })],
      pullRequests: [],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result.map((b) => b.name)).toEqual(["phase2-ui-copy"]);
    expect(result[0].aheadBy).toBe(4);
  });

  it("does NOT flag a branch with an open PR — the control", () => {
    // Without this the guard would report every branch in flight, which is
    // noise, and noise is how a weekly report stops being read.
    const result = findStrandedBranches({
      branches: [branch("ticker-restyle")],
      pullRequests: [openPr("ticker-restyle", 50)],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("does NOT flag a branch with nothing on it — merged or never advanced", () => {
    const result = findStrandedBranches({
      branches: [branch("already-merged", { aheadBy: 0 })],
      pullRequests: [],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("never flags the default branch, whatever it is called", () => {
    for (const name of ["main", "master", "trunk"]) {
      const result = findStrandedBranches({
        branches: [branch(name, { aheadBy: 12 })],
        pullRequests: [],
        defaultBranch: name,
        now: NOW,
      });
      expect(result).toEqual([]);
    }
  });

  it("STILL flags a branch whose PR was closed without merging", () => {
    // The deliberate one. A closed-unmerged PR is where commits are most
    // likely to be forgotten, so closing a PR must not launder the branch off
    // this list.
    const result = findStrandedBranches({
      branches: [branch("abandoned-idea", { aheadBy: 3 })],
      pullRequests: [{ number: 27, headRefName: "abandoned-idea", state: "CLOSED" }],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result.map((b) => b.name)).toEqual(["abandoned-idea"]);
  });

  it("distinguishes two branches when only one of them has the open PR", () => {
    // Guards against a matcher that ignores the branch name and answers the
    // same way for everything — the failure mode AGENTS.md's Verifying section
    // is about.
    const result = findStrandedBranches({
      branches: [branch("has-pr"), branch("no-pr")],
      pullRequests: [openPr("has-pr")],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result.map((b) => b.name)).toEqual(["no-pr"]);
  });
});

describe("ordering and age", () => {
  it("puts the oldest tip commit first", () => {
    const result = findStrandedBranches({
      branches: [
        branch("recent", { lastCommitISO: "2026-08-27T12:00:00Z" }),
        branch("ancient", { lastCommitISO: "2026-07-01T12:00:00Z" }),
        branch("middle", { lastCommitISO: "2026-08-10T12:00:00Z" }),
      ],
      pullRequests: [],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result.map((b) => b.name)).toEqual(["ancient", "middle", "recent"]);
  });

  it("counts age in whole days from the injected clock", () => {
    const result = findStrandedBranches({
      branches: [branch("b", { lastCommitISO: "2026-08-25T12:00:00Z" })],
      pullRequests: [],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result[0].ageDays).toBe(3);
  });

  it("floors a same-day commit to 0 rather than reporting a negative age", () => {
    const result = findStrandedBranches({
      branches: [branch("b", { lastCommitISO: "2026-08-28T23:00:00Z" })],
      pullRequests: [],
      defaultBranch: "main",
      now: NOW,
    });
    expect(result[0].ageDays).toBe(0);
  });
});

describe("the report", () => {
  it("returns null when nothing is stranded, so clean is distinguishable", () => {
    expect(formatStrandedReport([], "AccelerationCC/client-newsroom")).toBeNull();
  });

  it("names each branch, its commit count and who last touched it", () => {
    const stranded = findStrandedBranches({
      branches: [
        branch("phase2-ui-copy", {
          aheadBy: 4,
          lastCommitISO: "2026-08-20T12:00:00Z",
          lastCommitAuthor: "Yuvraj Singh",
          lastCommitSubject: "feat(settings): replace the sidebar's user name",
        }),
      ],
      pullRequests: [],
      defaultBranch: "main",
      now: NOW,
    });
    const report = formatStrandedReport(stranded, "AccelerationCC/acc360v2")!;
    expect(report).toContain("phase2-ui-copy");
    expect(report).toContain("4 commits ahead");
    expect(report).toContain("8d ago");
    expect(report).toContain("Yuvraj Singh");
    expect(report).toContain("AccelerationCC/acc360v2");
  });

  it("singularises one branch and one commit", () => {
    const report = formatStrandedReport(
      [
        {
          name: "solo",
          aheadBy: 1,
          ageDays: 0,
          lastCommitISO: "2026-08-28T00:00:00Z",
          lastCommitAuthor: "A",
          lastCommitSubject: "s",
        },
      ],
      "r",
    )!;
    expect(report).toContain("1 branch on r carries");
    expect(report).toContain("1 commit ahead");
    expect(report).toContain("today");
  });
});
