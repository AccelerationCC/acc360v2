import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CompanyForm } from '@/components/companies/CompanyForm'

export default async function NewCompanyPage() {
  const user = await currentUser()
  if (!user || user.publicMetadata?.role !== 'superexec') {
    redirect('/companies')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-light">Add Company</h1>
        <p className="text-muted text-sm mt-1">
          Fill in the details below. The form fields are pulled directly from
          your Airtable table schema.
        </p>
      </div>
      <CompanyForm />
    </div>
  )
}
