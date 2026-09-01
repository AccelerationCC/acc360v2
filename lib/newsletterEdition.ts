import { getNewsletter } from './kv'
import { getObservances, observancesForEdition, resolveObservanceDate } from './observances'
import type {
  HeroSlot,
  NewsletterEdition,
  ObservanceItem,
  RegenerableSlotId,
} from '@/types/newsletterTemplate'

/**
 * Composing one edition, slot by slot.
 *
 * THE REASON EACH SLOT HAS ITS OWN FUNCTION is the brief's requirement that
 * regenerating one slot leave the others byte-identical. That is only
 * structurally guaranteed if no slot's value can depend on another's, so each
 * builder takes the edition date and nothing else. `regenerateSlot` then
 * replaces exactly one key of an existing edition, and there is no code path
 * that recomputes a neighbour as a side effect.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "22 April" — fixed format, deliberately not Intl. */
function dateLabel(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** "Monday, 22 April 2026" — the edition line's fixed format. */
export function editionLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const weekday = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ][d.getUTCDay()]
  return `${weekday}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/**
 * The hero.
 *
 * Static copy today. It is a SLOT rather than hardcoded markup because the
 * brief calls for a regenerate action on it, and because the headline is the
 * one line an editor will want to change per edition. Nothing generates it —
 * there is no model call here, deliberately.
 */
export function buildHero(isoDate: string): HeroSlot {
  return {
    headline: 'The Acceleration Brief',
    lede:
      'The day in brief for the Hot List, alongside the observances coming up. ' +
      'Everything below is assembled automatically each morning.',
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
  }
}

/**
 * The observances for this edition.
 *
 * `articles` is ALWAYS EMPTY today, and that is the shipped steady state rather
 * than a placeholder: the article pull is Part 3, blocked behind the ACC360
 * Perigon swap (client-newsroom issues/031 step 2b). The template renders an
 * explicit "no recent coverage" line for an empty list, which is a required
 * state in the brief regardless of whether Part 3 has landed.
 *
 * It must NOT be filled from web_search as an interim measure — see
 * client-newsroom issues/034 for why that retrieval path produces briefs nobody
 * can reconstruct.
 */
export function buildObservances(isoDate: string): ObservanceItem[] {
  const editionDate = new Date(`${isoDate}T00:00:00Z`)
  const year = editionDate.getUTCFullYear()

  return observancesForEdition(editionDate).map((o) => {
    // The occurrence actually in the window may be next year's (a late-December
    // edition reaching January), so pick whichever of the two is nearer.
    const candidates = [year, year + 1].map((y) => resolveObservanceDate(o, y))
    const at = candidates.reduce((best, c) =>
      Math.abs(c.getTime() - editionDate.getTime()) < Math.abs(best.getTime() - editionDate.getTime())
        ? c
        : best,
    )
    return {
      id: o.id,
      name: o.name,
      category: o.category,
      dateLabel: dateLabel(at),
      imageUrl: o.imageUrl,
      imageAlt: o.imageAlt,
      articles: [],
    }
  })
}

/** The existing Hot List brief, unchanged. Read straight from KV. */
export async function buildBrief(isoDate: string) {
  return getNewsletter(isoDate)
}

/** Compose a whole edition. Every slot built independently. */
export async function buildEdition(isoDate: string): Promise<NewsletterEdition> {
  return {
    date: isoDate,
    composedAt: new Date().toISOString(),
    hero: buildHero(isoDate),
    observances: buildObservances(isoDate),
    brief: await buildBrief(isoDate),
  }
}

/**
 * Replace exactly one slot, leaving every other key referentially unchanged.
 *
 * Returns a new object (the caller may be holding the old one), but every
 * untouched slot is the SAME REFERENCE, not a copy. That is what makes
 * "regenerating one slot leaves the others byte-identical" checkable rather
 * than merely intended — the test asserts reference equality, which a deep
 * re-clone would fail even if it happened to serialise the same.
 */
export async function regenerateSlot(
  edition: NewsletterEdition,
  slot: RegenerableSlotId,
): Promise<NewsletterEdition> {
  switch (slot) {
    case 'hero':
      return { ...edition, hero: buildHero(edition.date) }
    case 'observances':
      return { ...edition, observances: buildObservances(edition.date) }
    case 'brief':
      return { ...edition, brief: await buildBrief(edition.date) }
  }
}
