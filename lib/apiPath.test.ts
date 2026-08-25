import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { apiUrl } from './apiPath'

describe('apiUrl', () => {
  // BASE_PATH is read at module load from NEXT_PUBLIC_BASE_PATH, which is
  // unset in the test env — so these pin the standalone (root) behaviour: a
  // deploy with no base path must keep working untouched.
  it('leaves paths unchanged when no base path is configured', () => {
    expect(apiUrl('/api/companies')).toBe('/api/companies')
    expect(apiUrl('/api/companies/rec123/hotlist')).toBe('/api/companies/rec123/hotlist')
  })

  it('leaves absolute URLs alone', () => {
    expect(apiUrl('https://example.com/api/x')).toBe('https://example.com/api/x')
  })

  it('leaves relative paths alone', () => {
    expect(apiUrl('api/x')).toBe('api/x')
  })
})

// ============================================================================
// THE PIN. Next's basePath does not rewrite hand-written fetch() calls, so a
// raw fetch('/api/...') resolves against the origin and — when this app is
// mounted under /360 behind client-newsroom — hits the newsroom's origin
// instead of ACC360's API. That is the "Failed to fetch" bug. All 15 call
// sites now go through apiFetch; this fails the suite if a 16th appears.
// ============================================================================
describe('no client component calls fetch() on an app-absolute /api path', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))

  async function tsxFiles(dir: string): Promise<string[]> {
    const out: string[] = []
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const rel = join(dir, entry.name)
      if (entry.isDirectory()) out.push(...(await tsxFiles(rel)))
      else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(rel)
    }
    return out
  }

  it('finds zero raw fetch("/api…") call sites', async () => {
    const files = [...(await tsxFiles('app')), ...(await tsxFiles('components'))]
    // Matches fetch( immediately followed by a quote and /api — the exact
    // shape that breaks under basePath. apiFetch( does not match.
    const offenders: string[] = []
    for (const f of files) {
      const text = await readFile(join(root, f), 'utf-8')
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (/(?<!api)\bfetch\(\s*['"`]\/api/.test(lines[i])) offenders.push(`${f}:${i + 1}`)
      }
    }
    expect(offenders, `use apiFetch from lib/apiPath instead:\n${offenders.join('\n')}`).toEqual([])
  })

  it('scanned a meaningful number of files (guards against a broken walker)', async () => {
    const files = [...(await tsxFiles('app')), ...(await tsxFiles('components'))]
    expect(files.length).toBeGreaterThan(20)
  })

  it('confirms the converted sites really use apiFetch', async () => {
    const text = await readFile(join(root, 'app/(dashboard)/companies/page.tsx'), 'utf-8')
    expect(text).toContain("apiFetch('/api/companies')")
    expect(text).toContain("from '@/lib/apiPath'")
  })
})
