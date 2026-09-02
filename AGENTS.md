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
