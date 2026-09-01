import type { ObservanceCategory } from '@/lib/observances'
import type { Newsletter } from './newsletter'

/**
 * THE LOCKED TEMPLATE'S SLOTS, in render order.
 *
 * This array is the order. The template maps over nothing — each slot is
 * written out explicitly in NewsletterTemplate.tsx — so this exists to name the
 * slots for the preview's regenerate controls and for the test that asserts the
 * two agree. If a slot is added here and not to the component, the test fails.
 */
export const SLOT_IDS = [
  'masthead',
  'editionLine',
  'hero',
  'observances',
  'brief',
  'footer',
] as const

export type SlotId = (typeof SLOT_IDS)[number]

/**
 * Which slots have anything to regenerate.
 *
 * The other three are hardcoded markup — a masthead, a date in a fixed format,
 * and a legal footer. "Regenerating" them is a no-op by construction, and
 * offering a button that does nothing is worse than not offering one, so the
 * preview labels them static instead. See the note in the preview page.
 */
export const REGENERABLE_SLOTS = ['hero', 'observances', 'brief'] as const
export type RegenerableSlotId = (typeof REGENERABLE_SLOTS)[number]

/** One article beneath an observance. Part 3 fills these; today always empty. */
export interface ObservanceArticle {
  title: string
  url: string
  publishedAt: string
  sourceName: string
}

export interface ObservanceItem {
  id: string
  name: string
  category: ObservanceCategory
  /** Rendered date, e.g. "22 April". Fixed format, not locale-dependent. */
  dateLabel: string
  imageUrl: string | null
  imageAlt: string | null
  articles: ObservanceArticle[]
}

export interface HeroSlot {
  headline: string
  lede: string
  imageUrl: string | null
  imageAlt: string | null
  /** Explicit dimensions are required whenever imageUrl is set. */
  imageWidth: number | null
  imageHeight: number | null
}

/** Everything the template needs. The template reads nothing else. */
export interface NewsletterEdition {
  date: string
  composedAt: string
  hero: HeroSlot
  observances: ObservanceItem[]
  brief: Newsletter | null
}
