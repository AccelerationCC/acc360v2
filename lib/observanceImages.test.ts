import { describe, expect, it } from 'vitest'
import { getObservances } from './observances'

// EVERY ACTIVE OBSERVANCE NEEDS AN IMAGE AND ALT TEXT.
//
// THIS TEST FAILS TODAY, AND THAT IS THE POINT. All 20 rows carry
// imageUrl: null pending curation, so the newsletter's observance block renders
// without the images the exec asked for. Before this file, that state was
// invisible: nothing rendered wrong, nothing errored, the block just quietly had
// no pictures in it — which is the same shape as the four unwatched surfaces in
// client-newsroom issues/032.
//
// A red test is the artefact that makes the gap visible. It goes green when the
// images are curated and uploaded (see observance-images/README.md and
// scripts/upload-observance-images.ts), and not before.
//
// DO NOT "fix" this by skipping it, by asserting the current state, or by
// generating alt text. Generated alt text is a confident description of a
// picture nobody looked at, and it would turn a loud gap into a silent lie.

describe('every active observance ships with an image', () => {
  const rows = getObservances()

  it('has rows to check at all — the control against a vacuous pass', () => {
    // Without this, an empty getObservances() would satisfy every `for` below.
    expect(rows.length).toBeGreaterThan(0)
  })

  it('every active observance has an imageUrl', () => {
    const missing = rows.filter((o) => !o.imageUrl).map((o) => o.id)
    expect(missing, `${missing.length} of ${rows.length} rows have no image`).toEqual([])
  })

  it('every active observance has imageAlt', () => {
    const missing = rows.filter((o) => !o.imageAlt).map((o) => o.id)
    expect(missing, `${missing.length} of ${rows.length} rows have no alt text`).toEqual([])
  })

  it('never one without the other — an image with no alt, or alt with no image', () => {
    // The schema already refuses this pair at module load, so this asserts the
    // schema is still doing it rather than re-implementing the rule.
    const mismatched = rows
      .filter((o) => Boolean(o.imageUrl) !== Boolean(o.imageAlt))
      .map((o) => o.id)
    expect(mismatched).toEqual([])
  })
})
