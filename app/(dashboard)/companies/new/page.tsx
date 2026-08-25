import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CompanyForm } from '@/components/companies/CompanyForm'
import { hasAdminTier } from '@/lib/roles'

export default async function NewCompanyPage() {
  // Same predicate as requireAdmin, which gates the POST this form submits to.
  // This used to test `!== 'superexec'`, so a king or admin was allowed to
  // create a company by API but redirected away from the page for doing it.
  const user = await currentUser()
  if (!hasAdminTier(user?.publicMetadata?.role)) {
    redirect('/companies')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Add Company</h1>
        <p className="text-muted text-sm mt-1">
          Fill in the details below. The form fields are pulled directly from
          your Airtable table schema.
        </p>
      </div>
      <CompanyForm />
    </div>
  )
}
