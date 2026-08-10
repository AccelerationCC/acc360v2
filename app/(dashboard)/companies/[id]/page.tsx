'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Edit2, Trash2, GitCompare, Globe, Mail, MapPin, User, DollarSign, FileText, Flame } from 'lucide-react'
import { Company } from '@/types'
import { getCompanyName, getInitials, getAvatarColor, getPhaseStyle, formatRevenue, extractUrl } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { DeleteModal } from '@/components/companies/DeleteModal'
import { HotListToggle } from '@/components/companies/HotListToggle'
import { Newsroom } from '@/components/companies/Newsroom'
import { useApp } from '@/contexts/AppContext'
import { useAdmin } from '@/lib/hooks/useAdmin'

export default function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { toggleCompare, isSelectedForCompare, compareIds } = useApp()
  const { isAdmin } = useAdmin()

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  const selected  = company ? isSelectedForCompare(company.id) : false
  const canCompare = compareIds.length < 3 || selected

  useEffect(() => {
    fetch(`/api/companies/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(setCompany)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoader message="Loading…" />
  if (error || !company) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 text-sm mb-4">{error ?? 'Company not found'}</p>
        <Link href="/companies"><Button variant="secondary">Back</Button></Link>
      </div>
    )
  }

  const f    = company.fields
  const name = getCompanyName(f)

  const phase     = f['Phase'] as string | undefined
  const vertical  = f['Vertical'] as string | undefined
  const hq        = f['HQ'] as string | undefined
  const satOffices = f['Satellite Offices'] as string | undefined
  const contact   = f['Contact'] as string | undefined
  const title     = f['Title'] as string | undefined
  const email      = extractUrl(f['Email'] as string | undefined)
  const website    = extractUrl(f['Website'] as string | undefined)
  const clientList = extractUrl(f['Client List'] as string | undefined)
  const revenue    = f['Revenue (MM)']
  const ltmRevenue = f["LTM Revenue '25"] as string | undefined
  const ebitda     = f["EBITDA '25"] as string | undefined
  const forecast   = f['Forecast Revenue / EBITDA'] as string | undefined
  const onHotList      = Boolean(f['On Hot List'])
  const officesHotList = f['Offices (Hot List)'] as string | undefined
  const notes      = f['Notes'] as string | undefined

  const domain = website
    ? (() => { try { const u = website.startsWith('http') ? website : `https://${website}`; return new URL(u).hostname.replace(/^www\./, '') } catch { return null } })()
    : null

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Hero */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              loading="lazy"
              src={domain ? `https://img.logo.dev/${domain}?token=${process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN}` : '/fallback-logo.svg'}
              alt={`${name} logo`}
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = '/fallback-logo.svg'
              }}
              className="shrink-0 w-20 h-20 rounded-2xl object-contain bg-white p-2"
            />

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-light">{name}</h1>
                {phase && (
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${getPhaseStyle(phase)}`}>
                    {phase}
                  </span>
                )}
                {onHotList && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border bg-orange-500/15 text-orange-400 border-orange-500/25">
                    <Flame size={11} />
                    Hot List
                  </span>
                )}
              </div>
              {vertical && <p className="text-sm text-accent-teal">{vertical}</p>}
              {company.createdTime && (
                <p className="text-xs text-muted mt-1">
                  Added {new Date(company.createdTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => canCompare && toggleCompare(company.id)}
                disabled={!canCompare}
                className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border transition-all duration-[2000ms] active:scale-[0.97] ${
                  selected ? 'border-accent-orange/40 bg-accent-orange/10 text-accent-orange' : 'border-border text-muted hover:text-light'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <GitCompare size={13} />
                {selected ? 'In Compare' : 'Compare'}
              </button>
              {isAdmin && (
                <>
                  <HotListToggle
                    companyId={company.id}
                    companyName={name}
                    onHotList={onHotList}
                    onChange={(next) =>
                      setCompany((c) => (c ? { ...c, fields: { ...c.fields, 'On Hot List': next } } : c))
                    }
                  />
                  <Link href={`/companies/${company.id}/edit`} className="flex-1 sm:flex-none">
                    <Button size="sm" variant="secondary" icon={<Edit2 size={13} />} className="w-full sm:w-auto justify-center">Edit</Button>
                  </Link>
                  <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => setShowDelete(true)} className="flex-1 sm:flex-none justify-center">
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Key info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Location */}
          {(hq || satOffices) && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Location</p>
              </div>
              {hq && <p className="text-sm text-light font-medium">{hq}</p>}
              {satOffices && <p className="text-xs text-muted mt-1">Satellite: {satOffices}</p>}
            </div>
          )}

          {/* Contact */}
          {(contact || email) && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <User size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Contact</p>
              </div>
              {contact && <p className="text-sm text-light font-medium">{contact}</p>}
              {title   && <p className="text-xs text-muted">{title}</p>}
              {email && (
                email.includes('@')
                  ? <a href={`mailto:${email}`} className="text-xs text-accent-orange hover:underline mt-1 block">{email}</a>
                  : <p className="text-xs text-muted mt-1">{email}</p>
              )}
            </div>
          )}

          {/* Revenue */}
          {revenue !== undefined && revenue !== null && revenue !== '' && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Revenue</p>
              </div>
              <p className="text-xl font-bold text-light">{formatRevenue(revenue)}</p>
            </div>
          )}

          {/* Website */}
          {website && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Website</p>
              </div>
              <a href={website} target="_blank" rel="noopener noreferrer"
                className="text-sm text-accent-orange hover:underline break-all">
                {website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}

          {/* Client List */}
          {clientList && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Client List</p>
              </div>
              <a href={clientList} target="_blank" rel="noopener noreferrer"
                className="text-sm text-accent-orange hover:underline break-all">
                View clients ↗
              </a>
            </div>
          )}

          {/* LTM Revenue */}
          {ltmRevenue && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">LTM Revenue &apos;25</p>
              </div>
              <p className="text-xl font-bold text-light">{ltmRevenue}</p>
            </div>
          )}

          {/* EBITDA */}
          {ebitda && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">EBITDA &apos;25</p>
              </div>
              <p className="text-xl font-bold text-light">{ebitda}</p>
            </div>
          )}

          {/* Forecast */}
          {forecast && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Forecast Rev / EBITDA</p>
              </div>
              <p className="text-sm font-medium text-light">{forecast}</p>
            </div>
          )}

          {/* Offices (Hot List) */}
          {officesHotList && (
            <div className="bg-card border border-border rounded-xl p-4 transition-all duration-[2000ms] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-accent-orange" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Offices (Hot List)</p>
              </div>
              <p className="text-sm text-light">{officesHotList}</p>
            </div>
          )}
        </div>

        {/* Notes — full width */}
        {notes && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-accent-orange" />
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Notes</p>
            </div>
            <p className="text-sm text-light leading-relaxed whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {/* Newsroom — live web-search-backed coverage */}
        <Newsroom companyId={company.id} />

        <Link href="/companies">
          <Button variant="ghost" size="sm">← Back to Target List</Button>
        </Link>
      </div>

      {showDelete && (
        <DeleteModal
          companyId={company.id}
          companyName={name}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  )
}
