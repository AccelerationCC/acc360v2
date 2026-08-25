'use client'

import { useState, useCallback } from 'react'
import {
  Newspaper, Search, RefreshCw, ArrowUpRight, Info,
  TrendingUp, Users, DollarSign, Briefcase, Flame, Award, Circle,
} from 'lucide-react'
import {
  NewsroomResult, NewsArticle, NewsCategory, SourceTier,
} from '@/types/newsroom'
import { CATEGORY_COLORS, CATEGORY_COLOR_ALL } from '@/components/theme/category-colors'
import { apiFetch } from '@/lib/apiPath'

// ─── Category presentation ───────────────────────────────────────────────────
// Single source of truth for label + color + icon per category.
// Colors are chosen to sit on the ACC360 charcoal without clashing with acc-blue.

// Categorical hues, darkened for the cream page. These are the one place hue
// carries meaning rather than brand (green = finance, red = reputation), so
// they are NOT collapsed into the bronze/gold accents — each keeps its hue and
// is darkened until it clears 4.5:1 as TEXT on the page, which is how it is
// used (the category label at the bottom of this file sets `color`).
// Measured against hsl(45 38% 96%): ma 4.63, leadership 4.72, finance 4.60,
// client 4.81, drama 4.70, award 4.66, general 4.60, all 4.75.
// The originals measured 1.35–2.58:1 — every one failed.
const CATEGORY_META: Record<NewsCategory, { label: string; filterLabel: string; color: string; Icon: typeof Circle }> = {
  ma:         { label: 'M&A',        filterLabel: 'M&A',         color: CATEGORY_COLORS.ma, Icon: TrendingUp },
  leadership: { label: 'Leadership', filterLabel: 'Leadership',  color: CATEGORY_COLORS.leadership, Icon: Users },
  finance:    { label: 'Finance',    filterLabel: 'Finance',     color: CATEGORY_COLORS.finance, Icon: DollarSign },
  client:     { label: 'Client Wins',filterLabel: 'Client Wins', color: CATEGORY_COLORS.client, Icon: Briefcase },
  drama:      { label: 'Reputation', filterLabel: 'Drama',       color: CATEGORY_COLORS.drama, Icon: Flame },
  award:      { label: 'Awards',     filterLabel: 'Awards',      color: CATEGORY_COLORS.award, Icon: Award },
  general:    { label: 'Relevant',   filterLabel: 'General',     color: CATEGORY_COLORS.general, Icon: Circle },
}

const TIER_LABEL: Record<SourceTier, string> = { t1: 'Tier 1', t2: 'Tier 2', t3: 'Source' }

interface NewsroomProps {
  /** Airtable record id — when provided, the component fetches via GET /api/newsroom?id= */
  companyId?: string
  /** Direct fields — used by the demo page (POST). Ignored when companyId is set. */
  seed?: { name: string; domain?: string; vertical?: string; hq?: string; contact?: string }
}

export function Newsroom({ companyId, seed }: NewsroomProps) {
  const [data, setData] = useState<NewsroomResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState<NewsCategory | 'all'>('all')

  const pull = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = companyId
        ? await apiFetch(`/api/newsroom?id=${encodeURIComponent(companyId)}`)
        : await apiFetch('/api/newsroom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seed ?? {}),
          })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Failed to pull news')
      }
      const json: NewsroomResult = await res.json()
      setData(json)
      setActiveCat('all')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [companyId, seed])

  // Build category filter counts from the loaded articles.
  const catCounts = (() => {
    const c: Partial<Record<NewsCategory, number>> = {}
    data?.articles.forEach((a) => { c[a.category] = (c[a.category] ?? 0) + 1 })
    return c
  })()

  const visible = data
    ? activeCat === 'all'
      ? data.articles
      : data.articles.filter((a) => a.category === activeCat)
    : []

  // ── Launcher (pre-pull state) ──
  if (!data && !loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-acc-blue/10 border border-acc-blue/20 grid place-items-center">
            <Newspaper size={18} className="text-acc-blue" />
          </div>
          <div>
            <h2 className="font-editorial text-lg text-foreground flex items-center gap-2">Newsroom</h2>
            <p className="text-sm text-muted">Pull the latest verified coverage for this company, summarized and sorted.</p>
          </div>
        </div>
        <button
          onClick={pull}
          className="inline-flex items-center justify-center gap-2 font-medium rounded-2xl bg-acc-blue hover:bg-acc-gold text-navy px-4 py-2 text-sm shadow-md shadow-acc-blue/20 hover:shadow-xl hover:shadow-acc-blue/40 transition-all duration-[1200ms] active:scale-[0.97] focus:outline-none focus:ring-1 focus:ring-acc-blue whitespace-nowrap"
        >
          <Search size={15} /> Pull latest news
        </button>
        {error && <p className="text-red-400 text-xs sm:hidden">{error}</p>}
      </div>
    )
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
        <RefreshCw size={22} className="text-acc-blue animate-spin" />
        <p className="text-sm text-foreground font-medium">Searching the web for recent coverage…</p>
        <p className="text-xs text-muted">Verifying each result against the company&apos;s identity.</p>
      </div>
    )
  }

  // ── Results ──
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Executive brief */}
      <div className="relative overflow-hidden bg-card border border-border rounded-2xl p-6">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-acc-blue to-acc-gold" />
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-acc-blue">
            Executive Brief
          </span>
          <span className="text-[11px] text-muted flex items-center gap-1.5">
            Confidence <b className="text-acc-gold font-semibold">{data!.brief.confidence}</b>
            <span className="text-foreground/30">·</span>
            {data!.brief.sourceCount} {data!.brief.sourceCount === 1 ? 'source' : 'sources'}
          </span>
        </div>

        <p className="font-editorial text-[16px] leading-relaxed text-foreground mb-4">
          {data!.brief.summary}
        </p>

        {data!.brief.flags.length > 0 && (
          <div className="space-y-2.5">
            {data!.brief.flags.map((fl, i) => {
              const meta = CATEGORY_META[fl.category]
              return (
                <div key={i} className="flex gap-3 items-start text-sm text-foreground/90 leading-snug">
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border mt-0.5"
                    style={{ color: meta.color, borderColor: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span>{fl.text}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Feed header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-editorial text-xl text-foreground flex items-center gap-2.5">
          Relevant News
          <span className="font-sans text-xs font-semibold text-muted bg-background border border-border rounded-full px-2.5 py-0.5">
            {data!.articles.length} {data!.articles.length === 1 ? 'story' : 'stories'}
          </span>
        </h3>
        <button
          onClick={pull}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border hover:border-acc-blue/40 rounded-lg px-3 py-1.5 transition-all duration-[1200ms] active:scale-[0.97]"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Empty / sparse state */}
      {data!.sparse && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-foreground font-medium mb-1">No clearly-matching coverage found.</p>
          <p className="text-xs text-muted">
            {data!.note ?? 'This company has a thin or ambiguous news footprint. That itself can be useful signal for an indie target.'}
          </p>
        </div>
      )}

      {/* Category filters */}
      {!data!.sparse && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="All" count={data!.articles.length}
            active={activeCat === 'all'} color={CATEGORY_COLOR_ALL}
            onClick={() => setActiveCat('all')}
          />
          {(Object.keys(CATEGORY_META) as NewsCategory[])
            .filter((c) => (catCounts[c] ?? 0) > 0)
            .map((c) => (
              <FilterChip
                key={c}
                label={CATEGORY_META[c].filterLabel}
                count={catCounts[c]!}
                color={CATEGORY_META[c].color}
                active={activeCat === c}
                onClick={() => setActiveCat(c)}
              />
            ))}
        </div>
      )}

      {/* Feed */}
      {!data!.sparse && (
        <div className="flex flex-col">
          {visible.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted">
              No {CATEGORY_META[activeCat as NewsCategory]?.filterLabel.toLowerCase()} coverage in this pull.
            </div>
          ) : (
            visible.map((a, i) => <ArticleRow key={a.url + i} article={a} />)
          )}
        </div>
      )}

      {/* Footnote */}
      <div className="flex items-center gap-2 pt-3 border-t border-border/60 text-[11px] text-muted">
        <Info size={13} className="shrink-0" />
        Gathered by live web search and ranked by source credibility &amp; recency. Each result is verified against the company&apos;s domain before inclusion.
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterChip({
  label, count, color, active, onClick,
}: { label: string; count: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3.5 py-1.5 border transition-all duration-300 active:scale-[0.97] ${
        active
          ? 'text-navy border-transparent'
          : 'text-muted bg-card border-border hover:text-foreground hover:border-muted'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {!active && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className={active ? 'text-navy/60' : 'text-muted/70 font-normal'}>{count}</span>
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
      className="group flex gap-4 py-5 border-b border-border/40 hover:bg-light/[0.015] transition-colors px-1 -mx-1 rounded"
    >
      <span className="shrink-0 w-[3px] rounded self-stretch" style={{ backgroundColor: meta.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5 text-[11px]">
          <span className="font-bold uppercase tracking-wide text-[10.5px]" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-muted">·</span>
          <span className="font-semibold text-foreground/80 flex items-center gap-1.5">
            {a.source}
            <span
              className={`text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-px rounded ${
                a.tier === 't1'
                  ? 'text-acc-gold bg-acc-gold/10'
                  : 'text-muted bg-light/[0.04]'
              }`}
            >
              {TIER_LABEL[a.tier]}
            </span>
          </span>
          {a.ageLabel && (
            <>
              <span className="text-muted">·</span>
              <span className="text-muted">{a.ageLabel}</span>
            </>
          )}
        </div>
        <h4 className="font-editorial text-[17px] leading-snug text-foreground group-hover:text-white transition-colors mb-1">
          {a.title}
        </h4>
        {a.snippet && <p className="text-sm text-muted leading-relaxed">{a.snippet}</p>}
      </div>
      <ArrowUpRight
        size={18}
        className="shrink-0 self-center text-muted opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </a>
  )
}
