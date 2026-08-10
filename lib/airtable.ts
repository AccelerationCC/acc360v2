import Airtable from 'airtable'
import { AirtableFieldValue, Company, FieldSchema } from '@/types'

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! })
    .base(process.env.AIRTABLE_BASE_ID!)
}

function TABLE()   { return process.env.AIRTABLE_TABLE_NAME! }
function BASE_ID() { return process.env.AIRTABLE_BASE_ID! }

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getAllCompanies(): Promise<Company[]> {
  const records = await getBase()(TABLE()).select().all() as any[]

  return records.map((r: any) => ({
    id: r.id,
    createdTime: r._rawJson?.createdTime as string | undefined,
    fields: r.fields as Record<string, AirtableFieldValue>,
  }))
}

export async function getCompany(id: string): Promise<Company> {
  const record = await getBase()(TABLE()).find(id) as any

  return {
    id: record.id,
    createdTime: record._rawJson?.createdTime as string | undefined,
    fields: record.fields as Record<string, AirtableFieldValue>,
  }
}

/**
 * Airtable field types whose values Airtable produces itself. Including even
 * one of these in a create/update payload makes Airtable reject the whole
 * write with 422 — so a single formula column silently breaks every save.
 */
const COMPUTED_TYPES = new Set([
  'formula',
  'rollup',
  'count',
  'lookup',
  'multipleLookupValues',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
  'autoNumber',
  'button',
  'externalSyncSource',
  'aiText',
])

/** Writable in Airtable, but this form has no sane editor for them. */
const UNSUPPORTED_IN_FORM = new Set([
  'multipleRecordLinks',
  'multipleAttachments',
  'multipleCollaborators',
  'singleCollaborator',
  'barcode',
])

/**
 * Fetch field schema from the Airtable Metadata API.
 * Returns accurate types (singleSelect with options, url, email, etc.)
 * Computed and unsupported fields come back flagged `readOnly`.
 */
export async function getTableSchema(): Promise<FieldSchema[]> {
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID()}/tables`,
    { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Airtable metadata API ${res.status}: ${body}`)
  }
  const data = await res.json()

  const table = data.tables?.find((t: any) => t.name === TABLE())
  if (!table) return []

  return table.fields.map((f: any): FieldSchema => {
    const schema: FieldSchema = {
      name: f.name,
      type: airtableTypeToFieldType(f.type),
      readOnly: COMPUTED_TYPES.has(f.type) || UNSUPPORTED_IN_FORM.has(f.type),
    }
    if (f.options?.choices) {
      schema.options = f.options.choices.map((c: any) => c.name as string)
    }
    return schema
  })
}

function airtableTypeToFieldType(t: string): FieldSchema['type'] {
  const map: Record<string, FieldSchema['type']> = {
    singleLineText:       'text',
    multilineText:        'textarea',
    url:                  'url',
    email:                'email',
    currency:             'number',
    number:               'number',
    percent:              'number',
    duration:             'number',
    rating:               'number',
    singleSelect:         'select',
    multipleSelects:      'multiselect',
    checkbox:             'boolean',
    date:                 'date',
    dateTime:             'date',
    phoneNumber:          'text',
    richText:             'textarea',
    multipleRecordLinks:  'linked',
    count:                'number',
  }
  return map[t] ?? 'text'
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Writable field names, cached briefly so every save doesn't re-fetch the schema. */
let writableCache: { names: Set<string>; at: number } | null = null
const WRITABLE_TTL_MS = 5 * 60 * 1000

async function writableFieldNames(): Promise<Set<string> | null> {
  const now = Date.now()
  if (writableCache && now - writableCache.at < WRITABLE_TTL_MS) return writableCache.names

  try {
    const schema = await getTableSchema()
    if (schema.length === 0) return null
    const names = new Set(schema.filter((f) => !f.readOnly).map((f) => f.name))
    writableCache = { names, at: now }
    return names
  } catch (err) {
    // Metadata API unreachable — pass the payload through rather than dropping
    // every field and writing an empty record.
    console.error('[airtable] could not load schema for write sanitising:', err)
    return null
  }
}

/**
 * Drop anything Airtable won't accept (computed fields, linked records,
 * unknown columns) before writing. Without this, one formula column in the
 * table makes every create/update fail with 422.
 */
async function writableOnly(
  fields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const writable = await writableFieldNames()
  if (!writable) return fields

  const clean: Record<string, unknown> = {}
  const dropped: string[] = []
  for (const [name, value] of Object.entries(fields)) {
    if (writable.has(name)) clean[name] = value
    else dropped.push(name)
  }
  if (dropped.length) {
    console.log('[airtable] skipped non-writable fields:', dropped.join(', '))
  }
  return clean
}

export async function createCompany(
  fields: Record<string, unknown>
): Promise<Company> {
  const payload = await writableOnly(fields)
  const record = await getBase()(TABLE()).create(payload as Airtable.FieldSet) as any
  return { id: record.id, fields: record.fields as Record<string, AirtableFieldValue> }
}

export async function updateCompany(
  id: string,
  fields: Record<string, unknown>
): Promise<Company> {
  const payload = await writableOnly(fields)
  const record = await getBase()(TABLE()).update(id, payload as Airtable.FieldSet) as any
  return { id: record.id, fields: record.fields as Record<string, AirtableFieldValue> }
}

/** Pull the real reason out of an Airtable SDK error so the UI can show it. */
export function airtableError(err: any): { type: string; message: string; status: number } {
  return {
    type: err?.error ?? err?.type ?? 'UNKNOWN_ERROR',
    message: err?.message ?? String(err),
    status: err?.statusCode ?? err?.status ?? 500,
  }
}

export async function deleteCompany(id: string): Promise<void> {
  await getBase()(TABLE()).destroy(id)
}

/** Airtable checkbox field that drives the Hot List filter and the daily brief. */
export const HOT_LIST_FIELD = 'On Hot List'

/**
 * Flip a company's Hot List membership without touching any other field.
 * Deliberately narrow: unlike the full edit form this never resends the rest of
 * the record, so it can't trip over computed (formula/rollup/lookup) fields.
 */
export async function setHotList(id: string, onHotList: boolean): Promise<Company> {
  return updateCompany(id, { [HOT_LIST_FIELD]: onHotList })
}
