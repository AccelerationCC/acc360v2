'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, User, DollarSign, Globe, GitCompare, ExternalLink, Flame } from 'lucide-react'
import { cn, getCompanyName, getInitials, getAvatarColor, getPhaseStyle, formatRevenue, extractUrl } from '@/lib/utils'
import { useApp } from '@/contexts/AppContext'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { HotListToggle } from '@/components/companies/HotListToggle'
import { Company } from '@/types'

interface CompanyCardProps {
  company: Company
  /** Lets the parent list keep its own copy in sync when Hot List membership flips. */
  onHotListChange?: (id: string, onHotList: boolean) => void
}

export function CompanyCard({ company, onHotListChange }: CompanyCardProps) {
  const { toggleCompare, isSelectedForCompare, compareIds } = useApp()
  const { isAdmin } = useAdmin()
  const selected    = isSelectedForCompare(company.id)
  const canCompare  = compareIds.length < 3 || selected

  const f    = company.fields
  const name = getCompanyName(f)
  const initials    = getInitials(name)
  const avatarColor = getAvatarColor(name)

  const phase    = f['Phase'] as string | undefined
  const vertical = f['Vertical'] as string | undefined
  const hq       = f['HQ'] as string | undefined
  const contact  = f['Contact'] as string | undefined
  const title    = f['Title'] as string | undefined
  const revenue  = f['Revenue (MM)']
  const websiteRaw = f['Website'] as string | undefined
  const website    = extractUrl(websiteRaw)
  const [onHotList, setOnHotList] = useState(Boolean(f['On Hot List']))

  const domain = website
    ? (() => { try { const u = website.startsWith('http') ? website : `https://${website}`; return new URL(u).hostname.replace(/^www\./, '') } catch { return null } })()
    : null

  return (
    <div className={cn(
      'group relative bg-card rounded-[10px] border transition-all duration-[2000ms] flex flex-col',
      'hover:border-acc-blue/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5',
      selected ? 'border-acc-blue/60' : onHotList ? 'border-orange-500/40' : 'border-border'
    )}>
      {onHotList && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-orange-500/15 text-orange-400 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-orange-500/25 z-10">
          <Flame size={10} />
          Hot List
        </div>
      )}
      <div className="p-3 sm:p-5 flex-1 flex flex-col">

        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            loading="lazy"
            src={domain ? `https://img.logo.dev/${domain}?token=${process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN}` : '/fallback-logo.svg'}
            alt={`${name} logo`}
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = '/fallback-logo.svg'
            }}
            /* Plain white, not a palette token: this is a plate behind third-party
                 logo images, most of which are drawn for white. Against the cream
                 page the old #F5F2EF was near-invisible as a plate. */
              className="shrink-0 w-12 h-12 rounded-lg object-contain bg-white p-1"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground text-sm leading-snug truncate">{name}</h3>
            {vertical && (
              <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-muted-ink text-white truncate max-w-full">
                {vertical}
              </span>
            )}
          </div>
        </div>

        {/* Phase badge */}
        {phase && (
          <div className="mb-3">
            <span className={cn(
              'inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border',
              getPhaseStyle(phase)
            )}>
              {phase}
            </span>
          </div>
        )}

        {/* Key details */}
        <div className="space-y-1.5 text-xs flex-1">
          {hq && (
            <div className="flex items-center gap-1.5 text-muted">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate font-light">{hq}</span>
            </div>
          )}
          {contact && (
            <div className="flex items-center gap-1.5 text-muted">
              <User size={11} className="shrink-0" />
              <span className="truncate font-light">{contact}{title ? ` · ${title}` : ''}</span>
            </div>
          )}
          {revenue !== undefined && revenue !== null && revenue !== '' && (
            <div className="flex items-center gap-1.5 text-muted">
              <DollarSign size={11} className="shrink-0" />
              <span className="font-light">{formatRevenue(revenue)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-border">
          <Link
            href={`/companies/${company.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium bg-acc-blue/10 text-acc-blue hover:bg-acc-blue/20 active:scale-[0.97] transition-all duration-[1200ms]"
          >
            <Globe size={12} />
            View
          </Link>
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-foreground hover:bg-background active:scale-[0.97] transition-all duration-[1200ms]"
            >
              <ExternalLink size={12} />
              Site
            </a>
          )}
          <button
            onClick={() => canCompare && toggleCompare(company.id)}
            disabled={!canCompare}
            className={cn(
              'w-full sm:flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-[1200ms] active:scale-[0.97]',
              selected
                ? 'bg-acc-blue/15 text-acc-blue hover:bg-acc-blue/25'
                : 'text-muted hover:text-foreground hover:bg-background',
              !canCompare && 'opacity-40 cursor-not-allowed'
            )}
          >
            <GitCompare size={12} />
            {selected ? 'Remove' : 'Compare'}
          </button>
          {isAdmin && (
            <HotListToggle
              companyId={company.id}
              companyName={name}
              onHotList={onHotList}
              onChange={(next) => {
                setOnHotList(next)
                onHotListChange?.(company.id, next)
              }}
              variant="icon"
            />
          )}
        </div>
      </div>
    </div>
  )
}
