'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Company } from '@/types'
import { getCompanyName } from '@/lib/utils'
import { CompanyForm } from '@/components/companies/CompanyForm'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAdmin } from '@/lib/hooks/useAdmin'

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAdmin, isLoaded: adminLoaded } = useAdmin()

  useEffect(() => {
    if (adminLoaded && !isAdmin) router.replace('/companies')
  }, [adminLoaded, isAdmin, router])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/companies/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Company not found')
        return r.json()
      })
      .then(setCompany)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (!adminLoaded || (adminLoaded && !isAdmin)) return <PageLoader message="Loading…" />

  if (loading) return <PageLoader message="Loading company…" />

  if (error || !company) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 text-sm mb-4">{error ?? 'Company not found'}</p>
        <Link href="/companies">
          <Button variant="secondary">Back to Companies</Button>
        </Link>
      </div>
    )
  }

  const name = getCompanyName(company.fields)

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Company</h1>
        <p className="text-muted text-sm mt-1">
          Editing <span className="text-foreground font-medium">&ldquo;{name}&rdquo;</span> — all changes
          are saved directly to Airtable.
        </p>
      </div>
      <CompanyForm company={company} />
    </div>
  )
}
