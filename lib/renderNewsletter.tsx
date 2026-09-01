import { NewsletterTemplate } from '@/components/newsletter/NewsletterTemplate'
import type { NewsletterEdition } from '@/types/newsletterTemplate'

/**
 * THE ONE PLACE THE NEWSLETTER BECOMES HTML.
 *
 * The brief asked that the preview render "the exact HTML that would be sent,
 * not an approximation". There is no sender (see NewsletterTemplate's header),
 * so the invariant that replaces it is stricter and actually checkable: there
 * is exactly ONE function that produces newsletter HTML, and every consumer —
 * the preview page, the preview API, anything added later — calls it.
 *
 * An approximation can only appear if someone writes a second renderer.
 * newsletterRender.test.ts asserts this function is the only caller of
 * renderToStaticMarkup for the template.
 */
export async function renderNewsletterHtml(edition: NewsletterEdition): Promise<string> {
  // DYNAMIC IMPORT, not a top-level one. Next refuses a static
  // `react-dom/server` import from an App Route ("You're importing a component
  // that imports react-dom/server") and fails the build. Importing it at call
  // time keeps it out of the route's module graph. This is why the function is
  // async — nothing about the rendering itself is.
  const { renderToStaticMarkup } = await import('react-dom/server')
  return `<!doctype html>${renderToStaticMarkup(<NewsletterTemplate edition={edition} />)}`
}
