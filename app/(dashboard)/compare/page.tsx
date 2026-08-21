'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { GitCompare, X, Search, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { Company, AirtableFieldValue } from '@/types'
import { getCompanyName, formatFieldValue, formatRevenue, getInitials, getAvatarColor } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { MarkdownContent } from '@/components/ui/MarkdownContent'
import { useApp } from '@/contexts/AppContext'
import { useStatusMessages } from '@/lib/hooks/useStatusMessages'
import { apiFetch } from '@/lib/apiPath'

// ─── Fixed row order for the comparison table ─────────────────────────────────

type Fields = Record<string, AirtableFieldValue>

type CompareRow =
  | { label: string; kind: 'field';   getValue: (f: Fields) => string; isWebsite?: boolean }
  | { label: string; kind: 'contact' }

const COMPARE_ROWS: CompareRow[] = [
  { label: 'Vertical',        kind: 'field', getValue: (f) => formatFieldValue(f['Vertical']) },
  { label: 'LTM Revenue',     kind: 'field', getValue: (f) => formatRevenue(f["LTM Revenue '25"]) },
  { label: 'EBITDA',          kind: 'field', getValue: (f) => formatRevenue(f["EBITDA '25"]) },
  { label: 'Phase',           kind: 'field', getValue: (f) => formatFieldValue(f['Phase']) },
  { label: 'Office Location', kind: 'field', getValue: (f) => formatFieldValue(f['HQ'] ?? f['HQ (verified)']) },
  { label: 'Notes',           kind: 'field', getValue: (f) => formatFieldValue(f['Notes']) },
  { label: 'Contact',         kind: 'contact' },
  { label: 'Website',         kind: 'field', getValue: (f) => formatFieldValue(f['Website']), isWebsite: true },
]

// ─── Contact cell — combines name, title, email ───────────────────────────────

function ContactCell({ fields }: { fields: Fields }) {
  const name  = formatFieldValue(fields['Contact'])
  const title = formatFieldValue(fields['Title'])
  const email = formatFieldValue(fields['Email'])

  const hasName  = name  !== '—'
  const hasTitle = title !== '—'
  const hasEmail = email !== '—'

  if (!hasName && !hasTitle && !hasEmail) {
    return <span className="text-sm text-muted italic">—</span>
  }

  const subtitleParts = [hasTitle && title, hasEmail && email].filter(Boolean) as string[]

  return (
    <div className="space-y-0.5">
      {hasName && <p className="text-sm text-foreground">{name}</p>}
      {subtitleParts.length > 0 && (
        <p className={hasName ? 'text-xs text-muted' : 'text-sm text-foreground'}>
          {subtitleParts.join(' · ')}
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { compareIds, toggleCompare, clearCompare } = useApp()

  const urlIds = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const idsToShow = urlIds.length > 0 ? urlIds : compareIds

  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // AI evaluation state
  const [evalState, setEvalState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [evalText, setEvalText] = useState('')
  const [evalError, setEvalError] = useState('')

  const statusActive = evalState === 'loading' && !evalText
  const statusMessage = useStatusMessages(statusActive)

  useEffect(() => {
    apiFetch('/api/companies')
      .then((r) => r.json())
      .then((data: Company[]) => setAllCompanies(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Reset evaluation when the set of compared companies changes
  const idsKey = idsToShow.join(',')
  useEffect(() => {
    setEvalState('idle')
    setEvalText('')
    setEvalError('')
  }, [idsKey])

  const selected = useMemo(
    () => allCompanies.filter((c) => idsToShow.includes(c.id)),
    [allCompanies, idsToShow]
  )

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return allCompanies
      .filter((c) => !idsToShow.includes(c.id) && getCompanyName(c.fields).toLowerCase().includes(q))
      .slice(0, 8)
  }, [allCompanies, idsToShow, query])

  const atMax = idsToShow.length >= 3

  function pick(id: string) {
    toggleCompare(id)
    setQuery('')
    setDropdownOpen(false)
  }

  async function runEvaluation() {
    setEvalState('loading')
    setEvalText('')
    setEvalError('')

    const companyBlocks = selected.map((c) => {
      const f = c.fields
      return [
        `Company: ${getCompanyName(f)}`,
        `Vertical: ${formatFieldValue(f['Vertical'])}`,
        `LTM Revenue: ${formatRevenue(f["LTM Revenue '25"])}`,
        `EBITDA: ${formatRevenue(f["EBITDA '25"])}`,
        `Phase: ${formatFieldValue(f['Phase'])}`,
        `HQ: ${formatFieldValue(f['HQ'] ?? f['HQ (verified)'])}`,
        `Notes: ${formatFieldValue(f['Notes'])}`,
      ].join('\n')
    }).join('\n\n---\n\n')

    const companyNames = selected.map((c) => getCompanyName(c.fields)).join(', ')
    const message = [
      `Act as a senior M&A analyst at an agency-acquisition firm evaluating ${selected.length} agencies as acquisition targets: ${companyNames}.`,
      ``,
      `Comparison data:`,
      ``,
      companyBlocks,
      ``,
      `Provide a concise, skimmable evaluation. Compare across revenue, EBITDA, deal phase, and strategic fit. Give a clear recommendation on which is the stronger acquisition target and why. Use short paragraphs or a brief bulleted structure — keep it tight.`,
    ].join('\n')

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error ?? `Request failed (${res.status})`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setEvalText(accumulated)
      }

      setEvalState('done')
    } catch (err: any) {
      setEvalError(err.message || 'Something went wrong. Please try again.')
      setEvalState('error')
    }
  }

  if (loading) return <PageLoader message="Loading…" />

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GitCompare size={22} className="text-acc-blue" />
            Compare Companies
          </h1>
          <p className="text-muted text-sm mt-0.5">Select up to 3 companies to compare side by side</p>
        </div>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="sm:ml-auto"
            onClick={() => { clearCompare(); router.replace('/compare') }}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Search + selected pills */}
      <div className="space-y-3">
        {!atMax && (
          <div ref={searchRef} className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true) }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search and add a company…"
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-acc-blue focus:border-transparent transition-colors"
            />
            {dropdownOpen && suggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
                {suggestions.map((c) => {
                  const name = getCompanyName(c.fields)
                  return (
                    <button
                      key={c.id}
                      onMouseDown={() => pick(c.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-card transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[11px] shrink-0 ${getAvatarColor(name)}`}>
                        {getInitials(name)}
                      </div>
                      <span className="text-sm text-foreground truncate">{name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((c) => {
              const name = getCompanyName(c.fields)
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-acc-blue/10 border border-acc-blue/30 text-acc-blue"
                >
                  {name.length > 28 ? name.slice(0, 26) + '…' : name}
                  <button onClick={() => toggleCompare(c.id)} className="hover:text-white transition-colors">
                    <X size={11} />
                  </button>
                </span>
              )
            })}
            {atMax && (
              <span className="inline-flex items-center text-xs text-muted px-2 py-1.5">
                Max 3 companies
              </span>
            )}
          </div>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <GitCompare size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">No companies selected</p>
          <p className="text-xs mb-6">Search for companies above or use the &ldquo;Compare&rdquo; button on company cards</p>
          <Link href="/companies">
            <Button variant="secondary">Browse Companies</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Comparison table */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted uppercase tracking-wider w-44 sticky left-0 bg-surface">
                    Field
                  </th>
                  {selected.map((company) => {
                    const name = getCompanyName(company.fields)
                    return (
                      <th key={company.id} className="px-5 py-4 text-left">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${getAvatarColor(name)}`}>
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate max-w-[140px]">{name}</p>
                            <Link href={`/companies/${company.id}`} className="inline-flex items-center gap-0.5 text-xs text-muted hover:text-acc-blue">
                              View <ExternalLink size={10} />
                            </Link>
                          </div>
                          <button
                            onClick={() => toggleCompare(company.id)}
                            className="ml-auto text-muted hover:text-foreground shrink-0"
                            aria-label="Remove from comparison"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.label} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-card/30' : 'bg-transparent'}`}>
                    <td className="px-5 py-3.5 sticky left-0 bg-inherit">
                      <span className="text-xs font-medium text-muted">{row.label}</span>
                    </td>
                    {selected.map((company) => {
                      if (row.kind === 'contact') {
                        return (
                          <td key={company.id} className="px-5 py-3.5">
                            <ContactCell fields={company.fields} />
                          </td>
                        )
                      }

                      const display = row.getValue(company.fields)
                      const isEmpty = display === '—'

                      if (row.isWebsite && !isEmpty) {
                        const href = display.match(/^https?:\/\//i) ? display : `https://${display}`
                        return (
                          <td key={company.id} className="px-5 py-3.5">
                            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-acc-blue hover:underline">
                              Link <ExternalLink size={10} />
                            </a>
                          </td>
                        )
                      }

                      return (
                        <td key={company.id} className="px-5 py-3.5">
                          <span className={`text-sm ${isEmpty ? 'text-muted italic' : 'text-foreground'}`}>{display}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI Evaluation */}
          {selected.length >= 2 && (
            <div className="space-y-4">
              <Button
                variant="primary"
                size="md"
                loading={evalState === 'loading'}
                icon={evalState !== 'loading' ? <Sparkles size={14} /> : undefined}
                onClick={runEvaluation}
                disabled={evalState === 'loading'}
              >
                Have AI Evaluate This Comparison?
              </Button>

              {/* Loading: status messages → then streaming content */}
              {evalState === 'loading' && (
                <div className="rounded-2xl border border-border bg-card/20 px-6 py-5 relative">
                  {evalText ? (
                    <>
                      <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-3">
                        <Sparkles size={13} className="text-acc-blue/60 animate-pulse shrink-0" />
                        <span className="text-xs font-semibold text-acc-blue/60 uppercase tracking-wider">AI M&amp;A Evaluation</span>
                      </div>
                      <MarkdownContent>{evalText}</MarkdownContent>
                      <span className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-acc-blue animate-pulse" />
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted text-sm">
                      <Loader2 size={13} className="animate-spin shrink-0" />
                      <span>{statusMessage}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Done */}
              {evalState === 'done' && (
                <div className="rounded-2xl border border-border bg-card/20 px-6 py-5 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                    <Sparkles size={13} className="text-acc-blue shrink-0" />
                    <span className="text-xs font-semibold text-acc-blue uppercase tracking-wider">AI M&amp;A Evaluation</span>
                    <button
                      onClick={() => setEvalState('idle')}
                      className="ml-auto text-muted hover:text-foreground transition-colors"
                      aria-label="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <MarkdownContent>{evalText}</MarkdownContent>
                </div>
              )}

              {/* Error */}
              {evalState === 'error' && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-4 flex items-start gap-3">
                  <span className="text-red-400 text-sm flex-1">{evalError}</span>
                  <button
                    onClick={() => setEvalState('idle')}
                    className="text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                    aria-label="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
