'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, ChevronRight } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { Button } from '@/components/ui/Button'

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [
    { label: 'Home', href: '/' },
  ]

  if (pathname === '/') return crumbs

  const segments = pathname.split('/').filter(Boolean)
  let accumulated = ''

  for (const seg of segments) {
    accumulated += `/${seg}`
    const label =
      seg === 'companies'
        ? 'Companies'
        : seg === 'new'
        ? 'Add Company'
        : seg === 'edit'
        ? 'Edit'
        : seg === 'compare'
        ? 'Compare'
        : seg.startsWith('rec')
        ? 'Profile'
        : seg.charAt(0).toUpperCase() + seg.slice(1)

    crumbs.push({ label, href: accumulated })
  }

  return crumbs
}

export function TopBar() {
  const { toggleSidebar, compareIds } = useApp()
  const pathname = usePathname()
  const breadcrumbs = getBreadcrumbs(pathname)

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl">
      {/* Left: mobile hamburger + breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-1.5 rounded-md text-muted hover:text-foreground hover:bg-foreground/5 transition-colors duration-200"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>

        <nav className="flex items-center gap-1 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <ChevronRight size={14} className="text-muted shrink-0" />
              )}
              {i === breadcrumbs.length - 1 ? (
                <span className="text-foreground font-medium truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted hover:text-foreground transition-colors duration-200 truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right: compare badge if companies are selected */}
      {compareIds.length > 0 && (
        <Link href={`/compare?ids=${compareIds.join(',')}`}>
          <Button size="sm" variant="secondary">
            Compare ({compareIds.length})
          </Button>
        </Link>
      )}
    </header>
  )
}
