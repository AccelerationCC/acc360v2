// ─── Airtable Data Types ─────────────────────────────────────────────────────

export type AirtableFieldValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined

export interface Company {
  id: string
  fields: Record<string, AirtableFieldValue>
  createdTime?: string
}

// ─── Field Schema ─────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'multiselect'
  | 'url'
  | 'date'
  | 'email'
  | 'select'    // singleSelect — has options[]
  | 'linked'    // multipleRecordLinks — resolved to string, read-only in form

export interface FieldSchema {
  name: string
  type: FieldType
  options?: string[] // populated for 'select' type
  /**
   * True for fields Airtable computes itself (formula, rollup, lookup, count,
   * createdTime, autoNumber, …) and for types this form can't edit (linked
   * records, attachments, collaborators). Airtable rejects the ENTIRE write
   * with 422 if any of these appear in a create/update payload, so they are
   * shown read-only and stripped before every write.
   */
  readOnly?: boolean
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: string
}
