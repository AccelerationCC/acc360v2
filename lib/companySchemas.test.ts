import { describe, expect, it } from 'vitest'
import { companyFieldsSchema, hotListSchema, parseMutationBody } from './companySchemas'

describe('companyFieldsSchema', () => {
  // Every shape stringToAirtableValue can produce must survive, or a real edit
  // starts failing. That function's whole range is
  // string | number | boolean | string[] | null.
  it('accepts every value type the form actually sends', () => {
    const body = {
      Company: 'Acme Corp',
      'Revenue (MM)': 12.5,
      'On Hot List': true,
      'Satellite Offices': ['London', 'Tokyo'],
      Notes: null,
    }
    expect(companyFieldsSchema.parse(body)).toEqual(body)
  })

  it('accepts an empty body — a PATCH that changes nothing', () => {
    expect(companyFieldsSchema.parse({})).toEqual({})
  })

  it('accepts a long notes field', () => {
    const body = { Notes: 'x'.repeat(5000) }
    expect(companyFieldsSchema.parse(body)).toEqual(body)
  })

  // THE POINT. writableOnly already drops unknown field NAMES; these are the
  // shapes it would happily forward because it only looks at keys.
  it('rejects nested objects and functions-shaped values', () => {
    expect(() => companyFieldsSchema.parse({ Company: { deep: 'object' } })).toThrow()
    expect(() => companyFieldsSchema.parse({ Company: [{ deep: 1 }] })).toThrow()
    expect(() => companyFieldsSchema.parse({ Company: [['nested']] })).toThrow()
  })

  it('rejects a body that is not an object at all', () => {
    for (const body of [null, 'string', 42, true, [1, 2, 3]]) {
      expect(() => companyFieldsSchema.parse(body)).toThrow()
    }
  })

  it('rejects NaN and Infinity, which Airtable would 422 on', () => {
    expect(() => companyFieldsSchema.parse({ 'Revenue (MM)': NaN })).toThrow()
    expect(() => companyFieldsSchema.parse({ 'Revenue (MM)': Infinity })).toThrow()
  })

  it('bounds payload size — strings, arrays and key count', () => {
    expect(() => companyFieldsSchema.parse({ Notes: 'x'.repeat(20_000) })).toThrow()
    expect(() =>
      companyFieldsSchema.parse({ Offices: Array.from({ length: 500 }, () => 'city') }),
    ).toThrow()
    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`Field${i}`, 'v']),
    )
    expect(() => companyFieldsSchema.parse(tooManyKeys)).toThrow()
  })

  it('rejects an empty or absurd field name', () => {
    expect(() => companyFieldsSchema.parse({ '': 'value' })).toThrow()
    expect(() => companyFieldsSchema.parse({ ['k'.repeat(300)]: 'value' })).toThrow()
  })
})

describe('hotListSchema', () => {
  it('accepts a real boolean either way', () => {
    expect(hotListSchema.parse({ onHotList: true })).toEqual({ onHotList: true })
    expect(hotListSchema.parse({ onHotList: false })).toEqual({ onHotList: false })
  })

  it('rejects the string "false" and other truthy near-misses', () => {
    for (const onHotList of ['false', 'true', 0, 1, null, undefined, {}]) {
      expect(() => hotListSchema.parse({ onHotList })).toThrow()
    }
  })

  it('ignores extra keys rather than forwarding them', () => {
    expect(hotListSchema.parse({ onHotList: true, injected: 'x' })).toEqual({ onHotList: true })
  })
})

describe('parseMutationBody', () => {
  it('returns the parsed data on success', () => {
    const r = parseMutationBody(hotListSchema, { onHotList: true })
    expect(r).toEqual({ ok: true, data: { onHotList: true } })
  })

  // Production responses must not carry internals — the same rule the
  // invitations route follows. A field name is fine; a zod dump is not.
  it('returns a short message that names the field but leaks nothing', () => {
    const r = parseMutationBody(hotListSchema, { onHotList: 'yes' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('Invalid value for "onHotList"')
      expect(r.error).not.toContain('zod')
      expect(r.error).not.toContain('expected')
    }
  })

  it('handles a non-object body without throwing', () => {
    const r = parseMutationBody(companyFieldsSchema, 'not an object')
    expect(r.ok).toBe(false)
  })
})
