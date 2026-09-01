import { z } from 'zod'

/**
 * Observances and holidays for the newsletter's observance block.
 *
 * WHY A CHECKED-IN MODULE AND NOT A TABLE. The brief specified a Prisma
 * `Observance` model. This app has no Prisma and no Postgres — its stores are
 * Airtable and Vercel KV — and giving it a `DATABASE_URL` was rejected outright
 * in client-newsroom issues/031, because it doubles the number of apps that can
 * write to the newsroom's database. So the rows live here.
 *
 * That is not a downgrade for this particular data. These rows are hand-authored,
 * change perhaps twice a year, and have no admin UI. Validating them with Zod at
 * import means a malformed row fails the BUILD rather than a request — which is
 * strictly earlier than a CHECK constraint would have caught it.
 *
 * THE ARRAY IS NOT EXPORTED. Every consumer goes through getObservances().
 * The source can move to Airtable, or to the newsroom behind an API, without a
 * single template change — see the interface note above that function.
 */

// ── SCHEMA ──────────────────────────────────────────────────────────────────

export const OBSERVANCE_CATEGORIES = ['HEALTH', 'CULTURAL', 'FEDERAL', 'AWARENESS'] as const
export type ObservanceCategory = (typeof OBSERVANCE_CATEGORIES)[number]

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const ORDINALS = ['first', 'second', 'third', 'fourth', 'last'] as const

/**
 * `rule` is a closed grammar, not free text: "third Monday in January".
 *
 * Free text would need a parser that fails at RUNTIME on a row nobody tested.
 * A regex the schema enforces means an unparseable rule cannot exist — the
 * build stops. The month is named in the rule AND held in `month`; rather than
 * pick one and let the other drift (issues/029), the schema requires them to
 * agree, so the redundancy is checked instead of merely tolerated.
 */
const RULE_RE = new RegExp(
  `^(${ORDINALS.join('|')}) (${WEEKDAYS.join('|')}) in (${MONTHS.join('|')})$`,
)

/**
 * Exported for tests, which must be able to prove the schema REFUSES the shapes
 * it claims to. It is NOT the read interface — getObservances() is. Nothing in
 * the app parses a row itself; rows are validated once, at module load.
 */
export const ObservanceSchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'kebab-case id'),
    name: z.string().min(1).max(120),
    category: z.enum(OBSERVANCE_CATEGORIES),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31).nullable(),
    rule: z.string().regex(RULE_RE, 'e.g. "third Monday in January"').nullable(),
    // NON-EMPTY, and hand-authored. See the note on getObservances().
    searchTerms: z.array(z.string().min(1).max(120)).min(1),
    imageUrl: z.string().url().nullable(),
    imageAlt: z.string().min(1).max(300).nullable(),
    active: z.boolean(),
  })
  .superRefine((o, ctx) => {
    // EXACTLY ONE of day or rule. Both directions are errors, and both are
    // tested: a row with neither has no date at all, and a row with both has
    // two dates that can disagree.
    const hasDay = o.day !== null
    const hasRule = o.rule !== null
    if (hasDay === hasRule) {
      ctx.addIssue({
        code: 'custom',
        message: hasDay
          ? 'set day OR rule, not both'
          : 'set day OR rule, one is required',
        path: ['day'],
      })
    }
    // The rule names a month; `month` holds one. They must be the same month.
    if (hasRule) {
      const named = RULE_RE.exec(o.rule!)?.[3]
      const namedIndex = MONTHS.indexOf(named as (typeof MONTHS)[number]) + 1
      if (namedIndex !== o.month) {
        ctx.addIssue({
          code: 'custom',
          message: `rule says ${named} but month is ${MONTHS[o.month - 1]}`,
          path: ['rule'],
        })
      }
    }
    // An image needs its alt text. One without the other is either an
    // unlabelled image or a label for nothing.
    if ((o.imageUrl === null) !== (o.imageAlt === null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'imageUrl and imageAlt must be set together',
        path: ['imageAlt'],
      })
    }
  })

export type Observance = z.infer<typeof ObservanceSchema>

// ── THE ROWS ────────────────────────────────────────────────────────────────
//
// Hand-authored. `searchTerms` are written by a person, deliberately, and
// NOTHING GENERATES THEM — no model call, no derivation from `name`, no
// splitting the name into words. observances.test.ts asserts this structurally
// rather than trusting the comment.
//
// imageUrl/imageAlt are null pending curation: the brief calls for one curated
// image per observance uploaded to Vercel Blob, which is a human choice, not
// something to invent. The template renders correctly without them and the
// schema refuses a URL without alt text, so filling them in later is additive.

const OBSERVANCES: readonly unknown[] = [
  // ── FEDERAL ──
  { id: 'mlk-day', name: 'Martin Luther King Jr. Day', category: 'FEDERAL',
    month: 1, day: null, rule: 'third Monday in January',
    searchTerms: ['Martin Luther King Jr. Day', 'MLK Day observance'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'memorial-day', name: 'Memorial Day', category: 'FEDERAL',
    month: 5, day: null, rule: 'last Monday in May',
    searchTerms: ['Memorial Day observance', 'Memorial Day commemoration'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'juneteenth', name: 'Juneteenth National Independence Day', category: 'FEDERAL',
    month: 6, day: 19, rule: null,
    searchTerms: ['Juneteenth', 'Juneteenth National Independence Day'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'independence-day', name: 'Independence Day', category: 'FEDERAL',
    month: 7, day: 4, rule: null,
    searchTerms: ['Fourth of July', 'Independence Day celebrations'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'labor-day', name: 'Labor Day', category: 'FEDERAL',
    month: 9, day: null, rule: 'first Monday in September',
    searchTerms: ['Labor Day', 'Labor Day weekend'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'veterans-day', name: 'Veterans Day', category: 'FEDERAL',
    month: 11, day: 11, rule: null,
    searchTerms: ['Veterans Day', 'Veterans Day observance'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'thanksgiving', name: 'Thanksgiving Day', category: 'FEDERAL',
    month: 11, day: null, rule: 'fourth Thursday in November',
    searchTerms: ['Thanksgiving', 'Thanksgiving Day'],
    imageUrl: null, imageAlt: null, active: true },

  // ── HEALTH ──
  { id: 'american-heart-month', name: 'American Heart Month', category: 'HEALTH',
    month: 2, day: 1, rule: null,
    searchTerms: ['American Heart Month', 'heart health awareness'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'world-cancer-day', name: 'World Cancer Day', category: 'HEALTH',
    month: 2, day: 4, rule: null,
    searchTerms: ['World Cancer Day'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'mental-health-awareness-month', name: 'Mental Health Awareness Month', category: 'HEALTH',
    month: 5, day: 1, rule: null,
    searchTerms: ['Mental Health Awareness Month', 'mental health awareness'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'world-mental-health-day', name: 'World Mental Health Day', category: 'HEALTH',
    month: 10, day: 10, rule: null,
    searchTerms: ['World Mental Health Day'],
    imageUrl: null, imageAlt: null, active: true },

  // ── CULTURAL ──
  { id: 'black-history-month', name: 'Black History Month', category: 'CULTURAL',
    month: 2, day: 1, rule: null,
    searchTerms: ['Black History Month'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'womens-history-month', name: "Women's History Month", category: 'CULTURAL',
    month: 3, day: 1, rule: null,
    searchTerms: ["Women's History Month"],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'pride-month', name: 'Pride Month', category: 'CULTURAL',
    month: 6, day: 1, rule: null,
    searchTerms: ['Pride Month', 'LGBTQ Pride Month'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'hispanic-heritage-month', name: 'National Hispanic Heritage Month', category: 'CULTURAL',
    month: 9, day: 15, rule: null,
    searchTerms: ['National Hispanic Heritage Month', 'Hispanic Heritage Month'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'native-american-heritage-month', name: 'Native American Heritage Month', category: 'CULTURAL',
    month: 11, day: 1, rule: null,
    searchTerms: ['Native American Heritage Month'],
    imageUrl: null, imageAlt: null, active: true },

  // ── AWARENESS ──
  { id: 'international-womens-day', name: "International Women's Day", category: 'AWARENESS',
    month: 3, day: 8, rule: null,
    searchTerms: ["International Women's Day"],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'earth-day', name: 'Earth Day', category: 'AWARENESS',
    month: 4, day: 22, rule: null,
    searchTerms: ['Earth Day'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'breast-cancer-awareness-month', name: 'Breast Cancer Awareness Month', category: 'AWARENESS',
    month: 10, day: 1, rule: null,
    searchTerms: ['Breast Cancer Awareness Month'],
    imageUrl: null, imageAlt: null, active: true },
  { id: 'world-aids-day', name: 'World AIDS Day', category: 'AWARENESS',
    month: 12, day: 1, rule: null,
    searchTerms: ['World AIDS Day'],
    imageUrl: null, imageAlt: null, active: true },
]

/**
 * Parsed at MODULE LOAD, so a malformed row fails the build and every import.
 * There is no lazy path where a bad row reaches a request.
 */
const PARSED: readonly Observance[] = Object.freeze(
  OBSERVANCES.map((row, i) => {
    const result = ObservanceSchema.safeParse(row)
    if (!result.success) {
      const id = (row as { id?: unknown })?.id
      throw new Error(
        `Invalid observance at index ${i}${typeof id === 'string' ? ` (${id})` : ''}: ` +
          result.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '),
      )
    }
    return result.data
  }),
)

// Ids must be unique — the template keys on them, and a duplicate would render
// one row twice while silently hiding another.
const DUPLICATE_IDS = PARSED.map((o) => o.id).filter((id, i, all) => all.indexOf(id) !== i)
if (DUPLICATE_IDS.length > 0) {
  throw new Error(`Duplicate observance ids: ${DUPLICATE_IDS.join(', ')}`)
}

// ── THE INTERFACE ───────────────────────────────────────────────────────────

/**
 * THE ONLY WAY TO READ OBSERVANCES. Callers never import the array.
 *
 * This indirection is the point: the rows live in this file today, but the
 * source is expected to move — to Airtable, or to the newsroom behind an API —
 * and when it does, this function becomes async-backed and NOTHING ELSE
 * CHANGES. A template that imported the array would have to be rewritten.
 *
 * Returns only `active` rows. Retiring an observance is a flag, not a deletion,
 * so the row stays readable next year.
 */
export function getObservances(): readonly Observance[] {
  return PARSED.filter((o) => o.active)
}

/** Every row including inactive ones. For tooling and tests, not the template. */
export function getAllObservances(): readonly Observance[] {
  return PARSED
}

// ── DATE RESOLUTION ─────────────────────────────────────────────────────────

/**
 * The calendar date an observance falls on in a given year, in UTC.
 *
 * UTC throughout, matching how the newsletter keys its edition
 * (`new Date().toISOString().slice(0, 10)` in the generate route). Mixing a
 * local-time resolution into a UTC-keyed edition is an off-by-one waiting for
 * a reader in a negative offset.
 */
export function resolveObservanceDate(o: Observance, year: number): Date {
  if (o.day !== null) return new Date(Date.UTC(year, o.month - 1, o.day))

  const m = RULE_RE.exec(o.rule!)
  // Unreachable: the schema refuses a rule that does not match this regex.
  if (!m) throw new Error(`Unparseable rule on ${o.id}: ${o.rule}`)
  const ordinal = m[1] as (typeof ORDINALS)[number]
  const weekday = WEEKDAYS.indexOf(m[2] as (typeof WEEKDAYS)[number])

  if (ordinal === 'last') {
    // Walk back from the last day of the month to the first matching weekday.
    const lastDay = new Date(Date.UTC(year, o.month, 0)).getUTCDate()
    for (let d = lastDay; d > lastDay - 7; d--) {
      const candidate = new Date(Date.UTC(year, o.month - 1, d))
      if (candidate.getUTCDay() === weekday) return candidate
    }
    throw new Error(`No last ${m[2]} in ${o.month}/${year}`)
  }

  const nth = ORDINALS.indexOf(ordinal) + 1 // first -> 1
  const firstOfMonth = new Date(Date.UTC(year, o.month - 1, 1))
  const offset = (weekday - firstOfMonth.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, o.month - 1, 1 + offset + (nth - 1) * 7))
}

/**
 * The observances belonging to one edition.
 *
 * POLICY, NOT MEASUREMENT — these numbers are choices and are stated as such.
 * A forward-looking window: an observance is in the edition if it falls within
 * the next 30 days, or fell within the last 2 (so an edition the morning after
 * a holiday still mentions it). Nearest first, capped at 4 to match the
 * template's 2-4 slot.
 *
 * Month-long observances are dated at their start (Mental Health Awareness
 * Month is 1 May), so they surface in the run-up to and the first weeks of
 * their month, which is when coverage of them actually appears.
 */
export function observancesForEdition(
  editionDate: Date,
  opts: { lookBackDays?: number; lookAheadDays?: number; max?: number } = {},
): Observance[] {
  const { lookBackDays = 2, lookAheadDays = 30, max = 4 } = opts
  const DAY = 86_400_000
  const t = Date.UTC(
    editionDate.getUTCFullYear(),
    editionDate.getUTCMonth(),
    editionDate.getUTCDate(),
  )

  return getObservances()
    .flatMap((o) => {
      // Both this year and next, so a December edition can reach January.
      const years = [editionDate.getUTCFullYear(), editionDate.getUTCFullYear() + 1]
      return years.map((y) => ({ o, at: resolveObservanceDate(o, y) }))
    })
    .filter(({ at }) => {
      const delta = (at.getTime() - t) / DAY
      return delta >= -lookBackDays && delta <= lookAheadDays
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, max)
    .map(({ o }) => o)
}
