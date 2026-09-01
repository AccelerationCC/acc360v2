import { z } from 'zod'

/**
 * Runtime validation for the company-mutation payloads.
 *
 * WHAT THIS IS AND IS NOT. POST /api/companies and PATCH /api/companies/[id]
 * forward `await req.json()` straight into createCompany/updateCompany, so the
 * request body reaches the Airtable client as whatever JSON arrived.
 *
 * There is already a real mitigation in that path: writableOnly()
 * (lib/airtable.ts) reads the live table schema and drops every key that is not
 * a writable column, so unknown FIELD NAMES never reach Airtable. This is
 * defence in depth on the other axis — the SHAPE and SIZE of what survives that
 * filter — not a from-scratch fix.
 *
 * What it adds that writableOnly cannot:
 *  - the body must be a JSON object at all (not an array, string, or null);
 *  - values are limited to the types Airtable actually accepts, so a nested
 *    object or a function-shaped value cannot reach the API client;
 *  - strings, arrays and key counts are bounded, so a payload bomb is refused
 *    here rather than forwarded upstream and billed.
 *
 * Bounds come from the real writer, not from taste. components/companies/
 * CompanyForm.tsx builds every value through stringToAirtableValue, whose
 * entire range is `string | number | boolean | string[] | null` (AirtableFieldValue
 * in types/index.ts) — `null` on purpose, since an emptied field is sent as null
 * so Airtable clears it. There are no nested objects anywhere in that range.
 */

/** Exactly the value types stringToAirtableValue can produce, bounded. */
const airtableFieldValue = z.union([
  // Free text. Generous: Notes-style columns hold paragraphs.
  z.string().max(10_000),
  // Reject NaN and Infinity, which JSON.parse can't produce but a hand-rolled
  // client can, and which Airtable would 422 on anyway.
  z.number().refine(Number.isFinite, 'must be a finite number'),
  z.boolean(),
  // Multi-select: the form splits a comma-separated string into this.
  z.array(z.string().max(500)).max(100),
  // An emptied field on edit — this is how a column gets cleared.
  z.null(),
])

/**
 * The create/update body: a flat map of Airtable field name to value.
 *
 * Deliberately NOT an enumeration of known columns. The writable field set is
 * resolved at runtime from the live base schema (writableFieldNames), so a
 * hardcoded list here would drift the moment someone adds a column and would
 * reject a legitimate edit. Key count is capped instead — the table has well
 * under 100 columns and nothing legitimately posts more.
 */
export const companyFieldsSchema = z
  .record(z.string().min(1).max(200), airtableFieldValue)
  .refine((fields) => Object.keys(fields).length <= 100, {
    message: 'too many fields in one write',
  })

/** PATCH /api/companies/[id]/hotlist — one boolean, nothing else. */
export const hotListSchema = z.object({
  onHotList: z.boolean(),
})

/**
 * Parses a mutation body, returning either the parsed value or a message safe
 * to hand back to the caller.
 *
 * Returns rather than throws so the route handlers keep their existing shape:
 * they already answer with a 400 and a plain `{ error }`, and production
 * responses here must not carry internals (same rule the invitations route
 * follows). Zod's own issue text is summarised, never dumped.
 */
export function parseMutationBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): { ok: true; data: z.output<T> } | { ok: false; error: string } {
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, data: result.data }

  const first = result.error.issues[0]
  const path = first?.path.join('.')
  return {
    ok: false,
    error: path ? `Invalid value for "${path}"` : 'Invalid request body',
  }
}
