#!/usr/bin/env tsx
/**
 * Diagnose why saving a company back to Airtable fails.
 *
 * Checks, in order:
 *   1. Env vars are present.
 *   2. The PAT's scopes (needs data.records:write to save anything).
 *   3. Every field in the table, split into writable vs computed. Any computed
 *      field included in a write makes Airtable reject the WHOLE record.
 *   4. Optionally, a real no-op write (sets one text field to the value it
 *      already has) to prove the write path end-to-end without changing data.
 *
 * Usage:
 *   npx tsx scripts/diagnose-airtable-write.ts              # read-only checks
 *   npx tsx scripts/diagnose-airtable-write.ts --write-test # + no-op write
 *
 * Requires: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME in .env.local
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// ── Load .env.local (no dotenv dep required) ──────────────────────────────────
try {
  const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  // .env.local absent — env vars may already be set in the shell
}

const API_KEY    = process.env.AIRTABLE_API_KEY
const BASE_ID    = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME
const WRITE_TEST = process.argv.includes('--write-test')

const COMPUTED_TYPES = new Set([
  'formula', 'rollup', 'count', 'lookup', 'multipleLookupValues',
  'createdTime', 'lastModifiedTime', 'createdBy', 'lastModifiedBy',
  'autoNumber', 'button', 'externalSyncSource', 'aiText',
])

const UNSUPPORTED_IN_FORM = new Set([
  'multipleRecordLinks', 'multipleAttachments', 'multipleCollaborators',
  'singleCollaborator', 'barcode',
])

function head(s: string) { console.log(`\n${s}\n${'─'.repeat(s.length)}`) }

async function main() {
  head('1. Environment')
  const missing = [
    ['AIRTABLE_API_KEY', API_KEY],
    ['AIRTABLE_BASE_ID', BASE_ID],
    ['AIRTABLE_TABLE_NAME', TABLE_NAME],
  ].filter(([, v]) => !v).map(([k]) => k)

  if (missing.length) {
    console.error(`✗ Missing: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log(`✓ base=${BASE_ID}  table="${TABLE_NAME}"  key=${API_KEY!.slice(0, 12)}…`)

  const auth = { Authorization: `Bearer ${API_KEY}` }

  head('2. Token scopes')
  const who = await fetch('https://api.airtable.com/v0/meta/whoami', { headers: auth })
  if (!who.ok) {
    console.error(`✗ whoami returned ${who.status} — the token is invalid or revoked.`)
    process.exit(1)
  }
  const whoJson: any = await who.json()
  const scopes: string[] | undefined = whoJson.scopes
  if (scopes) {
    console.log(`  scopes: ${scopes.join(', ')}`)
    console.log(scopes.includes('data.records:write')
      ? '✓ data.records:write present — the token is allowed to save.'
      : '✗ data.records:write MISSING — this alone breaks every save. Regenerate the PAT with that scope.')
  } else {
    console.log('  (Airtable did not return a scope list for this token.)')
  }

  head('3. Field types')
  const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, { headers: auth })
  if (!metaRes.ok) {
    console.error(`✗ Metadata API returned ${metaRes.status}: ${await metaRes.text()}`)
    process.exit(1)
  }
  const meta: any = await metaRes.json()
  const table = meta.tables?.find((t: any) => t.name === TABLE_NAME)
  if (!table) {
    console.error(`✗ No table named "${TABLE_NAME}". Found: ${meta.tables?.map((t: any) => t.name).join(', ')}`)
    process.exit(1)
  }

  const computed = table.fields.filter((f: any) => COMPUTED_TYPES.has(f.type))
  const unsupported = table.fields.filter((f: any) => UNSUPPORTED_IN_FORM.has(f.type))
  const writable = table.fields.filter(
    (f: any) => !COMPUTED_TYPES.has(f.type) && !UNSUPPORTED_IN_FORM.has(f.type))

  console.log(`  ${writable.length} writable, ${computed.length} computed, ${unsupported.length} unsupported-in-form`)
  if (computed.length) {
    console.log('\n  Computed (Airtable 422s the whole record if these are sent):')
    computed.forEach((f: any) => console.log(`    • ${f.name}  [${f.type}]`))
  }
  if (unsupported.length) {
    console.log('\n  Unsupported in the form:')
    unsupported.forEach((f: any) => console.log(`    • ${f.name}  [${f.type}]`))
  }
  if (computed.length + unsupported.length > 0) {
    console.log('\n  → These are now stripped before every write by lib/airtable.ts.')
  } else {
    console.log('  → No computed fields, so they are not the cause. Check scopes above.')
  }

  head('4. Write test')
  if (!WRITE_TEST) {
    console.log('  skipped — pass --write-test to run a no-op write against one record.')
    return
  }

  const listRes = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME!)}?maxRecords=1`,
    { headers: auth })
  const list: any = await listRes.json()
  const record = list.records?.[0]
  if (!record) {
    console.log('  ✗ Table has no records to test against.')
    return
  }

  const probe = writable.find(
    (f: any) => f.type === 'singleLineText' && typeof record.fields[f.name] === 'string')
  if (!probe) {
    console.log('  ✗ No populated single-line-text field to use as a safe no-op probe.')
    return
  }

  // Writes the value the field already holds — nothing actually changes.
  const patch = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME!)}`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      records: [{ id: record.id, fields: { [probe.name]: record.fields[probe.name] } }],
    }),
  })

  if (patch.ok) {
    console.log(`✓ Write succeeded (no-op on "${probe.name}" of ${record.id}). The two-way street is open.`)
  } else {
    const body = await patch.text()
    console.log(`✗ Write failed with ${patch.status}:\n  ${body}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
