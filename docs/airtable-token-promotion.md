# Promoting the new Airtable token to production — owner and check required

**Status:** open. Production is on the OLD token and works.
**Raised:** 2026-08-26. Deliberately not done during a demo window.

## Where it stands

| `AIRTABLE_API_KEY` | created | updated |
|---|---|---|
| **production** | 2026-06-23 19:34 | never — this is the OLD token |
| **preview** | 2026-08-25 21:13 | 2026-08-25 21:13 — the NEW token |

The new token is staged to Preview and has never been promoted.

## Why it sat forgotten for a day

This is the part worth keeping, because the staging itself was fine.

The swap was designed as: put the new token on Preview → verify by editing a
company at the Preview URL → promote to production. Steps one and three are
configuration changes with a record. Step two was **"then someone edits a
company"** — a manual action with no owner, no deadline, and nothing anywhere
that would notice it had not happened.

So the sequence stalled at step two and looked, from every artifact it left
behind, exactly like a sequence in progress. It was found only because someone
asked the question out loud a day later.

**A staged rollout whose gate is an unassigned manual action is not staged, it
is stalled.** Any future credential swap needs the verification step to carry a
named owner and a check that fails loudly if it has not run — the same standard
applied to migrations here.

## The sequence, when it is done

1. **Owner:** named before starting, not after.
2. Verify the Preview token can both **read and write**: load `/360/companies`
   on the Preview URL and edit one company. A read alone proves nothing — a
   token scoped `data.records:read` but not `:write` passes a read check and
   fails every mutation, which is precisely the failure this step exists to
   catch.
3. Confirm scopes: `data.records:read`, `data.records:write`, and
   `schema.bases:read` (the form builder needs the schema), on **one** base.
4. Promote to production, then immediately repeat step 2 against production —
   one read, one edit, reverted.
5. Record the promotion date here.
6. Revoke the old token only after step 4 passes.

## Why it was not done on 2026-08-26

The current token works, and a demo was running. Swapping a working credential
into a live demo window adds a variable to the one window where an unexplained
failure is most expensive. Held deliberately, not forgotten — which is the
distinction this file exists to make.
