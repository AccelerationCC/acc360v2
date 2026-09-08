<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- Everything below is hand-written and sits OUTSIDE the generated block
     above, which `next dev` rewrites between its BEGIN/END markers. -->

## Checks

Run all three before opening a PR. Every one must exit 0.

| Check | Command | Baseline |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | exits 0, no output |
| Tests | `npx vitest run` | passing — nothing may regress |
| Lint | `npm run lint` | clean across the **whole repo** |

Lint is whole-repo here, unlike the newsroom, which lints only changed files
because it carries ~800 pre-existing violations. `eslint .` is clean in this
repo, so the stronger gate is the one that runs. **If violations accumulate, clear
them — do not narrow the gate to changed files.** A narrowed gate is
indistinguishable from a working one, which is the whole failure this section
exists to prevent.

No database and no live credentials. This app has no Prisma and no
`DATABASE_URL`; Airtable and Vercel KV are mocked in every test that touches them
(`vi.mock` in `lib/execGate.test.ts`, `lib/newsletterTemplate.test.ts`). A test
that needs a real credential is a conversation about the test.

### Before merging: Guard 1 must have REPORTED, not merely not-failed

`.github/workflows/checks.yml` runs types, tests and lint on every PR to `main`.
It is named **types, tests, lint** on the PR page.

**GitHub cannot enforce it.** Branch protection needs a paid plan on a private
repo, and `GET /branches/main/protection` returns 403 here. So "required" is a
discipline, not a setting, and the discipline is:

> **Confirm the check reports SUCCESS before merging. An absent check is not a
> pass — it means it has not run yet.** `gh pr checks <n>` printing
> *"no checks reported"* on a branch pushed seconds ago is the normal state
> immediately after a push, and reading it as green is the mistake.

Until 2026-09-01 this repo had no such job at all. CI was `dependency-audit`,
`secret-scan` and a Vercel build, so green meant "no known-vulnerable dependency,
no committed secret, and `next build` compiles" — while 187 tests ran nowhere but
a laptop. Every test-shaped guard here, including the role boundaries in
`lib/execGate.test.ts`, was decorative. See the header of `checks.yml`.

## Two GitHub accounts — and a 404 that reads as a typo

Two accounts exist. **Only `yuvrajsinghacc` can see both
`AccelerationCC/acc360v2` and `AccelerationCC/client-newsroom`.** The other one
authenticates fine and then cannot find the repos.

**The failure is misleading, which is the whole problem.** GitHub returns **404,
not 403**, for a private repo the caller is not authorised to see — disclosing
"this repo exists but you may not have it" would itself be a leak. So the wrong
account does not say *you lack access*. It says the repo **does not exist**:

```
gh: Not Found (HTTP 404)
```

That reads as a misspelled repo name. The hour goes into checking the spelling,
the owner, the case, whether the repo was renamed or archived — every hypothesis
except the account, because nothing in the message points at auth.

**`gh auth status` does not settle it.** It reports who is logged in, not what
they can reach. A green "Logged in to github.com account …" is compatible with
404 on every repo you care about.

**The rule: prove access against the repo itself, not against the session.**

```
gh api repos/<owner>/<repo> --jq .permissions
```

The tell:

```
{"admin":true,"maintain":true,"pull":true,"push":true,"triage":true}   <- right account
gh: Not Found (HTTP 404)                                              <- WRONG ACCOUNT, not a bad name
```

A 404 from that call, on a name you can otherwise confirm, means the account —
not the spelling. Switch with `gh auth switch` and re-run before touching
anything else.

Verified 2026-09-08 on a fresh machine: `yuvrajsinghacc` returns the permissions
object above for both repos. The same section is in client-newsroom's `AGENTS.md`.
