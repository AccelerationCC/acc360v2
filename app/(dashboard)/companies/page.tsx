'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Plus, X, Flame } from 'lucide-react'
import { Company } from '@/types'
import { getCompanyName } from '@/lib/utils'
import { CompanyCard } from '@/components/companies/CompanyCard'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useApp } from '@/contexts/AppContext'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { apiFetch } from '@/lib/apiPath'

type Filters = {
  vertical: string
  phase: string
  hq: string
  satellite: string
}

const EMPTY_FILTERS: Filters = { vertical: '', phase: '', hq: '', satellite: '' }

function unique(companies: Company[], field: string): string[] {
  const vals = companies.flatMap((c) => {
    const v = c.fields[field]
    if (!v) return []
    if (Array.isArray(v)) return v.map(String)
    return [String(v)]
  })
  return Array.from(new Set(vals)).sort()
}

// Inner component reads searchParams — must be inside Suspense
function CompaniesContent() {
  const searchParams = useSearchParams()
  const { compareIds, clearCompare } = useApp()
  const { isAdmin } = useAdmin()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  // Pre-activate Hot List filter when the sidebar nav item passes ?hotlist=1
  const [hotListOnly, setHotListOnly] = useState(() => searchParams.get('hotlist') === '1')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    apiFetch('/api/companies')
      .then((r) => { if (!r.ok) throw new Error('Failed to fetch'); return r.json() })
      .then((data: Company[]) => setCompanies(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const verticals  = useMemo(() => unique(companies, 'Vertical'), [companies])
  const phases     = useMemo(() => unique(companies, 'Phase'), [companies])
  const hqs        = useMemo(() => unique(companies, 'HQ'), [companies])
  const satellites = useMemo(() => unique(companies, 'Satellite Offices'), [companies])

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const f = c.fields
      if (hotListOnly && !f['On Hot List']) return false
      if (filters.vertical  && f['Vertical'] !== filters.vertical)  return false
      if (filters.phase     && f['Phase'] !== filters.phase)         return false
      if (filters.hq        && f['HQ'] !== filters.hq)               return false
      if (filters.satellite && f['Satellite Offices'] !== filters.satellite) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const name = getCompanyName(f).toLowerCase()
        if (!name.includes(q) && !Object.values(f).some((v) => String(v ?? '').toLowerCase().includes(q)))
          return false
      }
      return true
    })
  }, [companies, filters, search, hotListOnly])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => { setCurrentPage(1) }, [search, filters, hotListOnly])

  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const hasActiveFilters  = activeFilterCount > 0 || hotListOnly

  function setFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setSearch('')
    setHotListOnly(false)
  }

  // Keep the Hot List count and filter honest after a card toggles membership
  function handleHotListChange(id: string, onHotList: boolean) {
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, fields: { ...c.fields, 'On Hot List': onHotList } } : c))
    )
  }

  const hotListCount = companies.filter((c) => c.fields['On Hot List']).length

  if (loading) return <PageLoader message="Loading companies…" />

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="secondary">Retry</Button>
      </div>
    )
  }

  const filterOptions: { key: keyof Filters; label: string; options: string[] }[] = [
    { key: 'phase',     label: 'Phase',             options: phases },
    { key: 'vertical',  label: 'Vertical',           options: verticals },
    { key: 'hq',        label: 'HQ',                 options: hqs },
    { key: 'satellite', label: 'Satellite Offices',  options: satellites },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="font-editorial text-2xl font-medium text-foreground tracking-[0.02em]">Companies</h1>
          <p className="font-light text-muted text-sm mt-0.5">
            {companies.length} record{companies.length !== 1 ? 's' : ''} in your database
          </p>
        </div>
        {isAdmin && (
          <div className="sm:ml-auto">
            <Link href="/companies/new">
              <Button icon={<Plus size={15} />}>Add Company</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Compare banner */}
      {compareIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 bg-acc-blue/10 border border-acc-blue/20 rounded-[10px] px-4 py-3 text-center sm:text-left">
          <p className="text-sm font-medium text-acc-blue">
            {compareIds.length} compan{compareIds.length === 1 ? 'y' : 'ies'} selected for comparison
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={clearCompare}>Clear</Button>
            <Link href={`/compare?ids=${compareIds.join(',')}`}>
              <Button size="sm">Compare Now</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies by name or any field…"
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm font-light text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-acc-blue focus:border-transparent transition-colors duration-200"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs transition-colors duration-200">
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {/* Hot List toggle */}
          <button
            onClick={() => setHotListOnly((v) => !v)}
            className={`col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors duration-200 ${
              hotListOnly
                ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
                : 'border-border text-muted hover:text-foreground'
            }`}
          >
            <Flame size={12} />
            Hot List {hotListCount > 0 && `(${hotListCount})`}
          </button>

          {filterOptions.map(({ key, label, options }) => (
            options.length > 0 && (
              <div key={key} className="relative">
                <select
                  value={filters[key]}
                  onChange={(e) => setFilter(key, e.target.value)}
                  className={`appearance-none w-full text-xs px-3 py-1.5 pr-7 rounded-lg border cursor-pointer bg-card transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-acc-blue ${
                    filters[key]
                      ? 'border-acc-blue/50 text-acc-blue bg-acc-blue/5'
                      : 'border-border text-muted hover:text-foreground'
                  }`}
                >
                  <option value="">{label}</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">▾</span>
              </div>
            )
          ))}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors duration-200"
            >
              <X size={11} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {(search || hasActiveFilters) && filtered.length !== companies.length && (
        <p className="text-xs font-light text-muted">
          Showing {filtered.length} of {companies.length} results
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {search || hasActiveFilters ? (
            <div className="space-y-3">
              <p className="text-sm font-light">No companies match your filters.</p>
              <button onClick={clearFilters} className="text-xs text-acc-blue hover:underline">
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-light">No companies yet.</p>
              {isAdmin && (
                <Link href="/companies/new">
                  <Button icon={<Plus size={15} />}>Add your first company</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginated.map((company) => (
              <CompanyCard key={company.id} company={company} onHotListChange={handleHotListChange} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-acc-blue text-white hover:opacity-90 disabled:bg-card disabled:text-muted disabled:border disabled:border-border"
              >
                Previous
              </button>
              <span className="text-sm font-light text-muted min-w-[110px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-acc-blue text-white hover:opacity-90 disabled:bg-card disabled:text-muted disabled:border disabled:border-border"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Page-level Suspense wrapper required for useSearchParams
export default function CompaniesPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading companies…" />}>
      <CompaniesContent />
    </Suspense>
  )
}
