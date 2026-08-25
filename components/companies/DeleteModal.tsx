'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/apiPath'

interface DeleteModalProps {
  companyId: string
  companyName: string
  onClose: () => void
}

export function DeleteModal({ companyId, companyName, onClose }: DeleteModalProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Delete failed')
      }

      toast.success(`"${companyName}" has been deleted`)
      router.push('/companies')
      router.refresh()
    } catch (err) {
      toast.error(String(err))
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-[10px] w-full max-w-md p-6 animate-fade-in">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4 mx-auto">
          <AlertTriangle size={22} className="text-red-400" />
        </div>

        {/* Copy */}
        <h2 className="text-lg font-medium text-foreground text-center mb-2">
          Delete Company
        </h2>
        <p className="text-sm font-light text-muted text-center leading-relaxed">
          Are you sure you want to permanently delete{' '}
          <span className="font-medium text-foreground">&ldquo;{companyName}&rdquo;</span>?
          This action cannot be undone and will remove the record from Airtable.
        </p>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
