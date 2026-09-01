import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { SLOT_IDS, REGENERABLE_SLOTS, type NewsletterEdition } from '@/types/newsletterTemplate'

const authMock = vi.fn()
const currentUserMock = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock, currentUser: currentUserMock }))

// No live KV in tests. The brief slot reads through this and nothing else.
const getNewsletterMock = vi.fn(async () => null)
vi.mock('./kv', () => ({
  getNewsletter: getNewsletterMock,
  saveNewsletter: vi.fn(),
  getArchiveDates: vi.fn(async () => []),
  getMostRecentNewsletter: vi.fn(async () => null),
}))

function signedInAsExec() {
  authMock.mockResolvedValue({ userId: 'user_abc' })
  currentUserMock.mockResolvedValue({ id: 'user_abc', publicMetadata: { role: 'exec' } })
}

afterEach(() => vi.clearAllMocks())

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('the template is locked', () => {
  const src = read('components/newsletter/NewsletterTemplate.tsx')

  it('takes only an edition — no className, style, order or children prop', () => {
    // WHAT A BROKEN VERSION LOOKS LIKE: `{ edition, className }` or
    // `{ edition, slots }` would let a caller restyle or reorder. The signature
    // is the mechanism, so the signature is what is asserted.
    const sig = /export function NewsletterTemplate\(\{([^}]*)\}: \{([^}]*)\}\)/.exec(src)
    expect(sig, 'component signature not found — test needs updating').toBeTruthy()
    expect(sig![1].trim()).toBe('edition')
    expect(sig![2]).toContain('NewsletterEdition')
    expect(sig![2]).not.toMatch(/className|style|children|order|slots/)
  })

  it('emits all six slots, in the order SLOT_IDS declares', () => {
    const markers = SLOT_IDS.map((id) => {
      const label = {
        masthead: 'SLOT 1: MASTHEAD',
        editionLine: 'SLOT 2: EDITION LINE',
        hero: 'SLOT 3: HERO',
        observances: 'SLOT 4: OBSERVANCES',
        brief: 'SLOT 5: HOT LIST BRIEF',
        footer: 'SLOT 6: FOOTER',
      }[id]
      return { id, at: src.indexOf(label!) }
    })
    for (const m of markers) expect(m.at, `${m.id} slot marker missing`).toBeGreaterThan(-1)
    const positions = markers.map((m) => m.at)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('THE CONTROL: a reordered SLOT_IDS would fail the order check', () => {
    const reordered = [...SLOT_IDS].reverse()
    const positions = reordered.map((id) =>
      src.indexOf(
        {
          masthead: 'SLOT 1: MASTHEAD',
          editionLine: 'SLOT 2: EDITION LINE',
          hero: 'SLOT 3: HERO',
          observances: 'SLOT 4: OBSERVANCES',
          brief: 'SLOT 5: HOT LIST BRIEF',
          footer: 'SLOT 6: FOOTER',
        }[id]!,
      ),
    )
    expect([...positions].sort((a, b) => a - b)).not.toEqual(positions)
  })

  it('every image carries alt text and explicit width and height', () => {
    const imgs = [...src.matchAll(/<img\b[\s\S]*?\/>/g)].map((m) => m[0])
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) {
      expect(img, img).toMatch(/\balt=/)
      expect(img, img).toMatch(/\bwidth=/)
      expect(img, img).toMatch(/\bheight=/)
    }
  })

  it('uses colour tokens, never a literal colour in the markup', () => {
    // Values appear once, in the :root block that DEFINES the tokens. Anywhere
    // else a hex or hsl() is a hardcoded colour.
    const rootBlock = /:root \{[\s\S]*?\}/.exec(src)?.[0] ?? ''
    const withoutDefinitions = src.replace(rootBlock, '')
    expect(withoutDefinitions).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(withoutDefinitions).not.toMatch(/\bhsl\(/)
    expect(rootBlock).toMatch(/--paper|--ink/)
  })
})

describe('renderNewsletterHtml is the only renderer', () => {
  // An "approximation" can only appear if a SECOND renderer is written, and
  // any second renderer must import react-dom/server. So that import is the
  // thing to constrain — repo-wide, not in a hand-listed pair of files, and by
  // import rather than by mention (a comment naming the function is not a
  // renderer, which an earlier version of this test got wrong).
  const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.vercel'])

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full, out)
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
    }
    return out
  }

  // Any reference to the module specifier — static import, dynamic import()
  // or require. The renderer uses a dynamic import (Next rejects a static one
  // from an App Route), so a `from '...'`-only pattern would miss it.
  const IMPORTS_SERVER_RENDERER = /['"]react-dom\/server['"]/

  it('only lib/renderNewsletter.tsx imports react-dom/server', () => {
    const offenders = walk(ROOT)
      .filter((f) => !f.endsWith('lib/renderNewsletter.tsx'))
      .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
      .filter((f) => IMPORTS_SERVER_RENDERER.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
    expect(IMPORTS_SERVER_RENDERER.test(read('lib/renderNewsletter.tsx'))).toBe(true)
  })

  it('THE CONTROL: the pattern matches a real second renderer', () => {
    expect(IMPORTS_SERVER_RENDERER.test("import { renderToString } from 'react-dom/server'")).toBe(true)
    // ...and not a mere mention of the function in prose.
    expect(IMPORTS_SERVER_RENDERER.test('// renderToStaticMarkup needs Node')).toBe(false)
  })
})

describe('the preview serves exactly what the renderer produces', () => {
  it('GET html === renderNewsletterHtml(GET edition)', async () => {
    signedInAsExec()
    const { GET } = await import('../app/api/newsletter/preview/route')
    const { renderNewsletterHtml } = await import('./renderNewsletter')

    const res = await GET(new NextRequest('http://localhost/api/newsletter/preview?date=2026-04-20'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { edition: NewsletterEdition; html: string }

    // THE REPLACEMENT FOR "preview byte-matches the sent HTML". Nothing sends,
    // so the checkable invariant is that the bytes the preview serves are the
    // bytes the single renderer produces for the same edition.
    expect(body.html).toBe(await renderNewsletterHtml(body.edition))
    expect(body.html.startsWith('<!doctype html>')).toBe(true)
  })

  it('THE CONTROL: a different edition produces different bytes', async () => {
    // Without this, the assertion above would also pass if renderNewsletterHtml
    // returned a constant.
    signedInAsExec()
    const { GET } = await import('../app/api/newsletter/preview/route')
    const a = await (await GET(new NextRequest('http://localhost/api/newsletter/preview?date=2026-04-20'))).json()
    const b = await (await GET(new NextRequest('http://localhost/api/newsletter/preview?date=2026-11-20'))).json()
    expect(a.html).not.toBe(b.html)
  })

  it('refuses a malformed date and a caller below exec tier', async () => {
    signedInAsExec()
    const { GET } = await import('../app/api/newsletter/preview/route')
    expect(
      (await GET(new NextRequest('http://localhost/api/newsletter/preview?date=20-04-2026'))).status,
    ).toBe(400)

    authMock.mockResolvedValue({ userId: null })
    expect((await GET(new NextRequest('http://localhost/api/newsletter/preview'))).status).toBe(401)

    authMock.mockResolvedValue({ userId: 'u1' })
    currentUserMock.mockResolvedValue({ id: 'u1', publicMetadata: { role: 'hr' } })
    expect((await GET(new NextRequest('http://localhost/api/newsletter/preview'))).status).toBe(403)
  })
})

describe('regenerating one slot leaves the others byte-identical', () => {
  it('replaces only the named slot, by reference', async () => {
    const { buildEdition, regenerateSlot } = await import('./newsletterEdition')
    const before = await buildEdition('2026-04-20')

    for (const slot of REGENERABLE_SLOTS) {
      const after = await regenerateSlot(before, slot)
      for (const other of REGENERABLE_SLOTS) {
        if (other === slot) continue
        // Reference equality, not deep equality: a re-clone that happened to
        // serialise the same would still be a slot that got recomputed.
        expect(after[other], `${slot} regen disturbed ${other}`).toBe(before[other])
      }
      expect(after.date).toBe(before.date)
    }
  })

  it('the rendered bytes outside the changed slot are unchanged', async () => {
    const { buildEdition, regenerateSlot } = await import('./newsletterEdition')
    const { renderNewsletterHtml } = await import('./renderNewsletter')
    const before = await buildEdition('2026-04-20')
    const after = await regenerateSlot(before, 'hero')
    // Hero content is deterministic today, so the whole document must match.
    expect(await renderNewsletterHtml(after)).toBe(await renderNewsletterHtml(before))
  })

  it('THE CONTROL: changing a slot DOES change the bytes', async () => {
    // Otherwise the assertion above is satisfied by a renderer that ignores
    // its input entirely.
    const { buildEdition } = await import('./newsletterEdition')
    const { renderNewsletterHtml } = await import('./renderNewsletter')
    const base = await buildEdition('2026-04-20')
    const edited = { ...base, hero: { ...base.hero, headline: 'Something else entirely' } }
    expect(await renderNewsletterHtml(edited)).not.toBe(await renderNewsletterHtml(base))
  })

  it('POST rejects a slot that is not regenerable', async () => {
    signedInAsExec()
    const { POST } = await import('../app/api/newsletter/preview/route')
    const { buildEdition } = await import('./newsletterEdition')
    const edition = await buildEdition('2026-04-20')
    for (const slot of ['masthead', 'editionLine', 'footer', 'nonsense']) {
      const res = await POST(
        new NextRequest('http://localhost/api/newsletter/preview', {
          method: 'POST',
          body: JSON.stringify({ edition, slot }),
        }),
      )
      expect(res.status, slot).toBe(400)
    }
  })
})

describe('an observance with no coverage says so', () => {
  it('renders the explicit line rather than omitting the observance', async () => {
    const { buildEdition } = await import('./newsletterEdition')
    const { renderNewsletterHtml } = await import('./renderNewsletter')
    // 20 April 2026: Earth Day is two days out and has no articles, because
    // the article pull is Part 3 and is not built. This is the steady state.
    const edition = await buildEdition('2026-04-20')
    expect(edition.observances.length).toBeGreaterThan(0)
    expect(edition.observances.every((o) => o.articles.length === 0)).toBe(true)

    const html = await renderNewsletterHtml(edition)
    for (const o of edition.observances) {
      // The observance is named AND the no-coverage line is present: it must
      // not be silently dropped.
      expect(html).toContain(o.name)
    }
    const occurrences = html.split('No recent coverage.').length - 1
    expect(occurrences).toBe(edition.observances.length)
  })

  it('THE CONTROL: an observance WITH articles renders links, not the line', async () => {
    const { buildEdition } = await import('./newsletterEdition')
    const { renderNewsletterHtml } = await import('./renderNewsletter')
    const base = await buildEdition('2026-04-20')
    const withArticle = {
      ...base,
      observances: [
        {
          ...base.observances[0],
          articles: [
            {
              title: 'A real headline',
              url: 'https://example.test/a',
              publishedAt: '2026-04-01T00:00:00Z',
              sourceName: 'Example',
            },
          ],
        },
        ...base.observances.slice(1),
      ],
    }
    const html = await renderNewsletterHtml(withArticle)
    expect(html).toContain('A real headline')
    expect(html.split('No recent coverage.').length - 1).toBe(base.observances.length - 1)
  })
})
