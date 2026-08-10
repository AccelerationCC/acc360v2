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
 * Fetch field schema from the Airtable Metadata API.
 * Returns accurate types (singleSelect with options, url, email, etc.)
 * Linked record fields are typed as 'linked' and excluded from forms.
 */
export async function getTableSchema(): Promise<FieldSchema[]> {
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID()}/tables`,
    { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
  )
  const data = await res.json()

  const table = data.tables?.find((t: any) => t.name === TABLE())
  if (!table) return []

  return table.fields.map((f: any): FieldSchema => {
    const schema: FieldSchema = {
      name: f.name,
      type: airtableTypeToFieldType(f.type),
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
    singleSelect:         'select',
    checkbox:             'boolean',
    date:                 'date',
    phoneNumber:          'text',
    richText:             'textarea',
    multipleRecordLinks:  'linked',
    count:                'number',
  }
  return map[t] ?? 'text'
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createCompany(
  fields: Record<string, unknown>
): Promise<Company> {
  const record = await getBase()(TABLE()).create(fields as Airtable.FieldSet) as any
  return { id: record.id, fields: record.fields as Record<string, AirtableFieldValue> }
}

export async function updateCompany(
  id: string,
  fields: Record<string, unknown>
): Promise<Company> {
  const record = await getBase()(TABLE()).update(id, fields as Airtable.FieldSet) as any
  return { id: record.id, fields: record.fields as Record<string, AirtableFieldValue> }
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
