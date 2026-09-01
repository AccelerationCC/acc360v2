import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  OBSERVANCE_CATEGORIES,
  ObservanceSchema,
  getAllObservances,
  getObservances,
  observancesForEdition,
  resolveObservanceDate,
} from './observances'

const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('the rows load and are well-formed', () => {
  it('parses every row at import — a malformed row would have thrown before this ran', () => {
    expect(getAllObservances().length).toBeGreaterThan(0)
  })

  it('covers all four categories, as the brief requires', () => {
    const present = new Set(getAllObservances().map((o) => o.category))
    for (const c of OBSERVANCE_CATEGORIES) expect(present).toContain(c)
  })

  it('every row has at least one searchTerm', () => {
    for (const o of getAllObservances()) {
      expect(o.searchTerms.length, o.id).toBeGreaterThan(0)
      for (const t of o.searchTerms) expect(t.trim(), o.id).not.toBe('')
    }
  })

  it('every row has exactly one of day or rule', () => {
    for (const o of getAllObservances()) {
      expect((o.day !== null) !== (o.rule !== null), o.id).toBe(true)
    }
  })

  it('ids are unique', () => {
    const ids = getAllObservances().map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// THE SCHEMA CONTROLS. Every assertion above passes on a file that happens to
// be correct today. These prove the schema REFUSES the bad shapes — without
// them, nothing distinguishes "validated" from "not validated at all".
describe('THE CONTROLS: the schema refuses what it claims to refuse', () => {
  const GOOD = {
    id: 'test-row',
    name: 'Test Row',
    category: 'HEALTH' as const,
    month: 3,
    day: 8,
    rule: null,
    searchTerms: ['test'],
    imageUrl: null,
    imageAlt: null,
    active: true,
  }

  /** The message a rejection produced, or null if the row was accepted. */
  const reject = (row: Record<string, unknown>): string | null => {
    const r = ObservanceSchema.safeParse(row)
    return r.success ? null : r.error.issues.map((i) => i.message).join('; ')
  }

  it('the known-good row is accepted — so a rejection below means something', () => {
    expect(reject(GOOD)).toBeNull()
  })

  it('rejects an empty searchTerms array', () => {
    // The brief says "reject the write". With a checked-in module the
    // equivalent is that the build fails, which is what the module's throw does.
    expect(reject({ ...GOOD, searchTerms: [] })).toMatch(/at least 1|too_small|expected/i)
  })

  it('rejects neither day nor rule, and both day and rule', () => {
    expect(reject({ ...GOOD, day: null, rule: null })).toMatch(/one is required/i)
    expect(reject({ ...GOOD, day: 8, rule: 'third Monday in March' })).toMatch(/not both/i)
    expect(reject({ ...GOOD, day: null, rule: 'third Monday in March' })).toBeNull()
  })

  it('rejects a rule whose month disagrees with the month field', () => {
    expect(reject({ ...GOOD, month: 3, day: null, rule: 'third Monday in January' })).toMatch(
      /rule says January but month is March/,
    )
  })

  it('rejects an unparseable rule', () => {
    expect(reject({ ...GOOD, day: null, rule: 'sometime in the spring' })).toBeTruthy()
    expect(reject({ ...GOOD, day: null, rule: 'fifth Monday in March' })).toBeTruthy()
  })

  it('rejects an image without alt text, and alt text without an image', () => {
    expect(reject({ ...GOOD, imageUrl: 'https://x.dev/a.jpg' })).toMatch(/together/)
    expect(reject({ ...GOOD, imageAlt: 'a picture' })).toMatch(/together/)
    expect(reject({ ...GOOD, imageUrl: 'https://x.dev/a.jpg', imageAlt: 'a picture' })).toBeNull()
  })

  it('rejects an out-of-range month and a non-kebab id', () => {
    expect(reject({ ...GOOD, month: 13 })).toBeTruthy()
    expect(reject({ ...GOOD, id: 'Not Kebab' })).toBeTruthy()
  })
})

describe('nothing generates searchTerms', () => {
  // THE STRUCTURAL CHECK the brief asks for. A comment saying "hand-authored"
  // is a claim nothing rechecks (issues/029). This walks the source and asserts
  // that the ONLY place searchTerms is assigned is the hand-authored table.
  //
  // What a broken version looks like: someone adds
  // `searchTerms: name.toLowerCase().split(' ')` as a fallback, or calls a
  // model to fill them. Either writes the identifier in a new file, or writes
  // it in observances.ts with something other than string literals — and both
  // are caught below.
  const ROOT = join(__dirname, '..')
  const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.vercel'])

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full, out)
      else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(full)
    }
    return out
  }

  it('no file outside the table assigns searchTerms', () => {
    const offenders: string[] = []
    for (const file of walk(ROOT)) {
      if (file.endsWith('lib/observances.ts') || file.endsWith('lib/observances.test.ts')) continue
      const src = readFileSync(file, 'utf8')
      // An assignment or object-literal write, not a mere read like `o.searchTerms`.
      if (/(^|[^.\w])searchTerms\s*[:=]/m.test(src)) offenders.push(file.slice(ROOT.length + 1))
    }
    expect(offenders).toEqual([])
  })

  it('every searchTerms value in the table is a literal, not an expression', () => {
    const src = readFileSync(join(__dirname, 'observances.ts'), 'utf8')
    const assignments = [...src.matchAll(/searchTerms:\s*(\[[^\]]*\])/g)].map((m) => m[1])
    expect(assignments.length).toBeGreaterThan(0)
    for (const a of assignments) {
      // Only quoted strings, commas and whitespace. A call, a template literal,
      // an identifier or a .split() would all fail this.
      expect(a, a).toMatch(/^\[\s*(?:(?:'[^']*'|"[^"]*")\s*,?\s*)+\]$/)
    }
  })

  it('THE CONTROL: a generated value would fail the literal check', () => {
    const generated = `[name.toLowerCase().split(' ')]`
    expect(generated).not.toMatch(/^\[\s*(?:(?:'[^']*'|"[^"]*")\s*,?\s*)+\]$/)
    const templated = '[`${name} awareness`]'
    expect(templated).not.toMatch(/^\[\s*(?:(?:'[^']*'|"[^"]*")\s*,?\s*)+\]$/)
  })
})

describe('resolveObservanceDate', () => {
  const byId = (id: string) => getAllObservances().find((o) => o.id === id)!

  it('resolves nth-weekday rules against known 2026 dates', () => {
    expect(iso(resolveObservanceDate(byId('mlk-day'), 2026))).toBe('2026-01-19')
    expect(iso(resolveObservanceDate(byId('memorial-day'), 2026))).toBe('2026-05-25')
    expect(iso(resolveObservanceDate(byId('labor-day'), 2026))).toBe('2026-09-07')
    expect(iso(resolveObservanceDate(byId('thanksgiving'), 2026))).toBe('2026-11-26')
  })

  it('moves with the year rather than returning a fixed date', () => {
    // THE CONTROL for the rule resolver. A hardcoded or year-ignoring
    // implementation passes every assertion above; this is the one it fails.
    expect(iso(resolveObservanceDate(byId('mlk-day'), 2027))).toBe('2027-01-18')
    expect(iso(resolveObservanceDate(byId('mlk-day'), 2026))).not.toBe(
      iso(resolveObservanceDate(byId('mlk-day'), 2027)),
    )
  })

  it('resolves fixed-day observances', () => {
    expect(iso(resolveObservanceDate(byId('juneteenth'), 2026))).toBe('2026-06-19')
    expect(iso(resolveObservanceDate(byId('earth-day'), 2026))).toBe('2026-04-22')
  })
})

describe('observancesForEdition', () => {
  it('picks the ones just ahead of the edition date', () => {
    // 20 April 2026: Earth Day (22 Apr) is two days out and must appear.
    const picked = observancesForEdition(new Date(Date.UTC(2026, 3, 20)))
    expect(picked.map((o) => o.id)).toContain('earth-day')
  })

  it('caps at 4 and orders nearest first', () => {
    const picked = observancesForEdition(new Date(Date.UTC(2026, 1, 1)), { lookAheadDays: 365 })
    expect(picked.length).toBeLessThanOrEqual(4)
    const dates = picked.map((o) => resolveObservanceDate(o, 2026).getTime())
    expect([...dates].sort((a, b) => a - b)).toEqual(dates)
  })

  it('includes one that just passed, within the look-back', () => {
    // 24 April 2026, two days after Earth Day.
    const picked = observancesForEdition(new Date(Date.UTC(2026, 3, 24)))
    expect(picked.map((o) => o.id)).toContain('earth-day')
  })

  it('THE CONTROL: excludes one outside the window in both directions', () => {
    // Without this, "it returned something" is indistinguishable from "it
    // returns everything regardless of date".
    const picked = observancesForEdition(new Date(Date.UTC(2026, 3, 20)))
    // World AIDS Day (1 Dec) is far ahead; Black History Month (1 Feb) is far behind.
    expect(picked.map((o) => o.id)).not.toContain('world-aids-day')
    expect(picked.map((o) => o.id)).not.toContain('black-history-month')
  })

  it('reaches across the year boundary', () => {
    // 20 December 2026 must be able to see MLK Day on 18 January 2027.
    const picked = observancesForEdition(new Date(Date.UTC(2026, 11, 20)), { lookAheadDays: 40 })
    expect(picked.map((o) => o.id)).toContain('mlk-day')
  })
})

describe('getObservances is the interface', () => {
  it('returns only active rows', () => {
    expect(getObservances().every((o) => o.active)).toBe(true)
  })

  it('does not export the underlying array', async () => {
    const mod = (await import('./observances')) as Record<string, unknown>
    expect(mod.OBSERVANCES).toBeUndefined()
    expect(typeof mod.getObservances).toBe('function')
  })
})
