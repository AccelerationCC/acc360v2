'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Newspaper, RefreshCw, Calendar, ChevronDown, ChevronUp,
  TrendingUp, Users, DollarSign, Briefcase, Flame, Award, Circle,
  ArrowUpRight, Info, Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Newsletter, NewsletterCompanySection } from '@/types/newsletter'
import type { NewsCategory, NewsArticle, SourceTier } from '@/types/newsroom'
import { CATEGORY_COLORS, CATEGORY_COLOR_ALL } from '@/components/theme/category-colors'
import { apiFetch, apiUrl } from '@/lib/apiPath'

// ─── Category meta — single source of truth, mirrors Newsroom.tsx ────────────

// Categorical hues, darkened for the cream page. These are the one place hue
// carries meaning rather than brand (green = finance, red = reputation), so
// they are NOT collapsed into the bronze/gold accents — each keeps its hue and
// is darkened until it clears 4.5:1 as TEXT on the page, which is how it is
// used (the category label at the bottom of this file sets `color`).
// Measured against hsl(45 38% 96%): ma 4.63, leadership 4.72, finance 4.60,
// client 4.81, drama 4.70, award 4.66, general 4.60, all 4.75.
// The originals measured 1.35–2.58:1 — every one failed.
const CATEGORY_META: Record<NewsCategory, {
  label: string
  filterLabel: string
  color: string
  Icon: React.ElementType
}> = {
  ma:         { label: 'M&A',         filterLabel: 'M&A',         color: CATEGORY_COLORS.ma, Icon: TrendingUp },
  leadership: { label: 'Leadership',  filterLabel: 'Leadership',  color: CATEGORY_COLORS.leadership, Icon: Users },
  finance:    { label: 'Finance',     filterLabel: 'Finance',     color: CATEGORY_COLORS.finance, Icon: DollarSign },
  client:     { label: 'Client Wins', filterLabel: 'Client Wins', color: CATEGORY_COLORS.client, Icon: Briefcase },
  drama:      { label: 'Reputation',  filterLabel: 'Drama',       color: CATEGORY_COLORS.drama, Icon: Flame },
  award:      { label: 'Awards',      filterLabel: 'Awards',      color: CATEGORY_COLORS.award, Icon: Award },
  general:    { label: 'Relevant',    filterLabel: 'General',     color: CATEGORY_COLORS.general, Icon: Circle },
}

const TIER_LABEL: Record<SourceTier, string> = { t1: 'Tier 1', t2: 'Tier 2', t3: 'Source' }

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDateLong(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function mondayOf(dateStr: string): string {
  const d   = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  return mon.toISOString().slice(0, 10)
}

function weekLabel(monday: string) {
  return `Week of ${new Date(monday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
}

// Group sorted dates (newest-first) into { weekKey → dates[] }
function groupByWeek(dates: string[]): { week: string; dates: string[] }[] {
  const map = new Map<string, string[]>()
  for (const d of dates) {
    const wk = mondayOf(d)
    if (!map.has(wk)) map.set(wk, [])
    map.get(wk)!.push(d)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, ds]) => ({ week, dates: ds }))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterChip({
  label, active, color, count, onClick,
}: { label: string; active: boolean; color: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-1.5 border transition-all duration-200 active:scale-[0.97]',
        active
          ? 'text-navy border-transparent'
          : 'text-muted bg-card border-border hover:text-foreground hover:border-muted',
      )}
      style={active ? { backgroundColor: color } : undefined}
    >
      {!active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {label}
      {count !== undefined && (
        <span className={active ? 'text-navy/60' : 'text-muted/70 font-normal'}>{count}</span>
      )}
    </button>
  )
}

function ArticleRow({ article: a }: { article: NewsArticle }) {
  const meta = CATEGORY_META[a.category]
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 py-4 border-b border-border/30 hover:bg-light/[0.015] transition-colors px-1 -mx-1 rounded last:border-b-0"
    >
      <span className="shrink-0 w-[3px] rounded self-stretch" style={{ backgroundColor: meta.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1 text-[11px]">
          <span className="font-bold uppercase tracking-wide" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-muted">·</span>
          <span className="font-semibold text-foreground/80 flex items-center gap-1.5">
            {a.source}
            <span className={cn(
              'text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-px rounded',
              a.tier === 't1' ? 'text-acc-gold bg-acc-gold/10' : 'text-muted bg-light/[0.04]',
            )}>
              {TIER_LABEL[a.tier]}
            </span>
          </span>
          {a.ageLabel && <><span className="text-muted">·</span><span className="text-muted">{a.ageLabel}</span></>}
        </div>
        <h4 className="font-editorial text-[16px] leading-snug text-foreground group-hover:text-white transition-colors mb-1">
          {a.title}
        </h4>
        {a.snippet && <p className="text-sm text-muted leading-relaxed">{a.snippet}</p>}
      </div>
      <ArrowUpRight size={16} className="shrink-0 self-center text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}

function CompanySection({
  section, activeCategory,
}: { section: NewsletterCompanySection; activeCategory: NewsCategory | 'all' }) {
  const { result, companyName, domain } = section
  const [expanded, setExpanded] = useState(true)

  const articles = activeCategory === 'all'
    ? result.articles
    : result.articles.filter((a) => a.category === activeCategory)

  const confidence = result.brief.confidence
  const confColor =
    confidence === 'HIGH'   ? '#3D7A50' :
    confidence === 'MEDIUM' ? '#896501' :
    '#C43B3B'

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Company header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-5 hover:bg-light/[0.02] transition-colors text-left"
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={domain
            ? `https://img.logo.dev/${domain}?token=${process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN}`
            : '/fallback-logo.svg'}
          alt={companyName}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-logo.svg' }}
          className="shrink-0 w-10 h-10 rounded-lg object-contain bg-white p-1"
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-editorial text-lg text-foreground">{companyName}</span>
            {result.sparse && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted border border-border rounded-full px-2 py-0.5">
                Sparse
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              Confidence
              <b className="font-bold" style={{ color: confColor }}>{confidence}</b>
            </span>
            <span className="text-foreground/30">·</span>
            <span>{result.brief.sourceCount} source{result.brief.sourceCount !== 1 ? 's' : ''}</span>
            <span className="text-foreground/30">·</span>
            <span>{result.articles.length} stor{result.articles.length !== 1 ? 'ies' : 'y'}</span>
          </div>
        </div>

        <div className="shrink-0 text-muted ml-2">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/40">
          {/* Executive brief */}
          <div className="relative pt-4">
            <div className="absolute left-0 top-4 bottom-0 w-[2px] bg-gradient-to-b from-acc-blue/60 to-acc-gold/40 rounded" />
            <div className="pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-acc-blue mb-2">
                Executive Brief
              </p>
              <p className="font-editorial text-[15px] leading-relaxed text-foreground">
                {result.brief.summary}
              </p>

              {result.brief.flags.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.brief.flags.map((fl, i) => {
                    const meta = CATEGORY_META[fl.category]
                    return (
                      <div key={i} className="flex gap-2.5 items-start text-sm text-foreground/90 leading-snug">
                        <span
                          className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border mt-0.5"
                          style={{ color: meta.color, borderColor: `${meta.color}60` }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-sm text-muted">{fl.text}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Articles */}
          {result.sparse ? (
            <div className="py-6 text-center text-sm text-muted">
              No clearly-matching recent coverage was found for this company.
            </div>
          ) : articles.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted">
              No {activeCategory !== 'all' ? CATEGORY_META[activeCategory].filterLabel.toLowerCase() : ''} coverage for this company.
            </div>
          ) : (
            <div className="flex flex-col">
              {articles.map((a, i) => <ArticleRow key={a.url + i} article={a} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Archive panel ────────────────────────────────────────────────────────────

function ArchivePanel({
  archiveDates, selectedDate, onSelect,
}: { archiveDates: string[]; selectedDate: string | null; onSelect: (date: string) => void }) {
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set())
  const weeks = useMemo(() => groupByWeek(archiveDates), [archiveDates])

  function toggleWeek(wk: string) {
    setOpenWeeks((prev) => {
      const next = new Set(prev)
      next.has(wk) ? next.delete(wk) : next.add(wk)
      return next
    })
  }

  if (archiveDates.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted">
        <Calendar size={24} className="mx-auto mb-3 opacity-40" />
        <p>The archive will fill in as daily newsletters are generated.</p>
        <p className="text-xs mt-1 text-muted/60">One entry is stored per day at ~6am ET.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {weeks.map(({ week, dates }) => (
        <div key={week} className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleWeek(week)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-light/[0.02] transition-colors text-left"
          >
            <span className="text-sm font-medium text-foreground">{weekLabel(week)}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted">{dates.length} day{dates.length !== 1 ? 's' : ''}</span>
              {openWeeks.has(week) ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
            </div>
          </button>

          {openWeeks.has(week) && (
            <div className="border-t border-border/60 divide-y divide-border/40">
              {dates.map((d) => (
                <button
                  key={d}
                  onClick={() => onSelect(d)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors hover:bg-light/[0.03]',
                    selectedDate === d ? 'text-acc-blue font-medium' : 'text-muted',
                  )}
                >
                  {formatDateShort(d)}
                  {selectedDate === d && <span className="text-[10px] text-acc-blue font-bold uppercase tracking-wide">Viewing</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface NewsletterResponse {
  newsletter: Newsletter | null
  date: string
  isToday: boolean
}

export default function NewsletterPage() {
  const [data, setData]             = useState<NewsletterResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [archiveDates, setArchiveDates] = useState<string[]>([])
  const [activeCompany, setActiveCompany] = useState<string>('all')
  const [activeCategory, setActiveCategory] = useState<NewsCategory | 'all'>('all')
  const [showArchive, setShowArchive] = useState(false)

  // Load today's (or most recent) newsletter + archive index in parallel
  useEffect(() => {
    Promise.all([
      apiFetch('/api/newsletter').then((r) => r.json() as Promise<NewsletterResponse>),
      apiFetch('/api/newsletter/archive').then((r) => r.json() as Promise<{ dates: string[] }>),
    ]).then(([news, arch]) => {
      setData(news)
      setArchiveDates(arch.dates ?? [])
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function loadDate(date: string) {
    setLoading(true)
    apiFetch(`/api/newsletter?date=${date}`)
      .then((r) => r.json() as Promise<NewsletterResponse>)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const newsletter = data?.newsletter ?? null

  // Derive available categories across all visible sections
  const visibleSections = useMemo(() => {
    if (!newsletter) return []
    if (activeCompany === 'all') return newsletter.sections
    return newsletter.sections.filter((s) => s.companyId === activeCompany)
  }, [newsletter, activeCompany])

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<NewsCategory, number>> = {}
    visibleSections.forEach((s) => {
      s.result.articles.forEach((a) => {
        counts[a.category] = (counts[a.category] ?? 0) + 1
      })
    })
    return counts
  }, [visibleSections])

  const totalArticles = useMemo(
    () => visibleSections.reduce((n, s) => n + s.result.articles.length, 0),
    [visibleSections],
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <RefreshCw size={22} className="text-acc-blue animate-spin" />
        <p className="text-sm text-foreground font-medium">Loading briefing…</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="border-b border-border/60 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-acc-blue mb-1">
              ACC360 Intelligence
            </p>
            <h1 className="font-editorial text-3xl text-foreground tracking-[0.01em]">
              Hot List Daily Brief
            </h1>
            {data && (
              <p className="text-sm text-muted mt-1 flex items-center gap-2">
                <Calendar size={13} />
                {formatDateLong(data.date)}
                {!data.isToday && (
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400/80 border border-amber-400/30 rounded-full px-2 py-0.5">
                    Archive
                  </span>
                )}
              </p>
            )}
          </div>

          {newsletter && (
            <div className="text-right shrink-0">
              <p className="text-[11px] text-muted">
                {newsletter.companiesSucceeded} of {newsletter.companiesAttempted} companies
              </p>
              <p className="text-[11px] text-muted">
                Generated {new Date(newsletter.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── No newsletter yet ── */}
      {!newsletter && (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <Newspaper size={32} className="text-acc-blue/40 mx-auto mb-4" />
          <h2 className="font-editorial text-xl text-foreground mb-2">No briefing available yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto">
            Today&apos;s brief will appear here after the daily generation runs at ~6am ET.
            Once Vercel KV is provisioned and the cron is active, briefings will accumulate automatically.
          </p>
          <p className="text-xs text-muted/60 mt-4">
            You can also trigger a manual run at <code className="text-acc-gold">{apiUrl('/api/newsletter/generate')}</code> with the correct <code className="text-acc-gold">CRON_SECRET</code> header.
          </p>
        </div>
      )}

      {newsletter && (
        <>
          {/* ── Filters ── */}
          <div className="space-y-3">
            {/* Company filter */}
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted shrink-0 mt-1.5 mr-1">
                <Building2 size={11} />
                Company
              </div>
              <FilterChip
                label="All" color={CATEGORY_COLOR_ALL} active={activeCompany === 'all'}
                count={newsletter.sections.length}
                onClick={() => setActiveCompany('all')}
              />
              {newsletter.sections.map((s) => (
                <FilterChip
                  key={s.companyId}
                  label={s.companyName} color="#577565"
                  active={activeCompany === s.companyId}
                  onClick={() => setActiveCompany(s.companyId)}
                />
              ))}
            </div>

            {/* Category filter */}
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted shrink-0 mt-1.5 mr-1">
                <Circle size={11} />
                Category
              </div>
              <FilterChip
                label="All" color={CATEGORY_COLOR_ALL} active={activeCategory === 'all'}
                count={totalArticles}
                onClick={() => setActiveCategory('all')}
              />
              {(Object.keys(CATEGORY_META) as NewsCategory[])
                .filter((c) => (categoryCounts[c] ?? 0) > 0)
                .map((c) => (
                  <FilterChip
                    key={c}
                    label={CATEGORY_META[c].filterLabel}
                    color={CATEGORY_META[c].color}
                    active={activeCategory === c}
                    count={categoryCounts[c]}
                    onClick={() => setActiveCategory(c)}
                  />
                ))}
            </div>
          </div>

          {/* ── Company sections ── */}
          <div className="space-y-4">
            {visibleSections.length === 0 ? (
              <div className="text-center py-12 text-muted text-sm">
                No sections match your filters.
              </div>
            ) : (
              visibleSections.map((section) => (
                <CompanySection
                  key={section.companyId}
                  section={section}
                  activeCategory={activeCategory}
                />
              ))
            )}
          </div>

          {/* ── Footnote ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/60 text-[11px] text-muted">
            <Info size={12} className="shrink-0" />
            Gathered by live web search at generation time. Each result is verified against the company&apos;s domain before inclusion.
          </div>
        </>
      )}

      {/* ── News Archive ── */}
      <div className="pt-4">
        <button
          onClick={() => setShowArchive((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 bg-card border border-border rounded-2xl hover:border-border/80 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-acc-blue" />
            <div>
              <p className="font-editorial text-lg text-foreground">News Archive</p>
              <p className="text-xs text-muted mt-0.5">
                {archiveDates.length === 0
                  ? 'No past briefings yet'
                  : `${archiveDates.length} briefing${archiveDates.length !== 1 ? 's' : ''} stored`}
              </p>
            </div>
          </div>
          {showArchive ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </button>

        {showArchive && (
          <div className="mt-3 bg-card border border-border rounded-2xl p-4">
            <ArchivePanel
              archiveDates={archiveDates}
              selectedDate={data?.date ?? null}
              onSelect={(date) => {
                loadDate(date)
                setActiveCompany('all')
                setActiveCategory('all')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        )}
      </div>

    </div>
  )
}
