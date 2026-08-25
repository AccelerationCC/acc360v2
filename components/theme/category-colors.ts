import type { NewsCategory } from '@/types/newsroom'

/**
 * Categorical hues for news categories, darkened for the cream page.
 *
 * These are the one place in the app where hue carries meaning rather than
 * brand (green = finance, red = reputation), so they are NOT collapsed into
 * the bronze/gold accents. Each keeps its hue and is darkened until it clears
 * 4.5:1 as TEXT on the page, which is how it is used — call sites set
 * `style={{ color }}` on the category label.
 *
 * Measured against the page, hsl(45 38% 96%):
 *   ma 4.63   leadership 4.72   finance 4.60   client 4.81
 *   drama 4.70   award 4.66   general 4.60   all 4.75
 *
 * The originals (#FFA300, #7FA6C9, #8FC7A0, #FECD42, #D98080, #C9A6D9,
 * #A7BDB1, #DFD5CC) measured 1.35–2.58:1 against cream — every one failed.
 * Re-measure before changing any value here; lightening one fails text.
 *
 * Keyed by NewsCategory so the record stays exhaustive: adding a category to
 * that union is a type error here until it gets a colour.
 */
export const CATEGORY_COLORS: Record<NewsCategory, string> = {
  ma: '#996200',
  leadership: '#41709A',
  finance: '#3D7A50',
  client: '#896501',
  drama: '#C43B3B',
  award: '#9C45C4',
  general: '#577565',
}

/** The "All" filter chip, which is not a NewsCategory. */
export const CATEGORY_COLOR_ALL = '#806751'
