'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Home, Building2, BarChart3, Plus,
  ChevronLeft, ChevronRight, Flame, Newspaper, ArrowLeft,
} from 'lucide-react'
import { UserButton, useUser } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { useApp } from '@/contexts/AppContext'
import { useAdmin } from '@/lib/hooks/useAdmin'

// useSearchParams requires a Suspense boundary in Next.js 14.
// Pulled into its own component so the outer Sidebar can suspend just this slice.
function NavItems({ sidebarOpen }: { sidebarOpen: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isHotList = pathname === '/companies' && searchParams.get('hotlist') === '1'
  const { isAdmin } = useAdmin()

  const items = [
    {
      href: '/',
      label: 'Home',
      icon: Home,
      active: pathname === '/',
    },
    {
      href: '/companies?hotlist=1',
      label: 'Hot List',
      icon: Flame,
      active: isHotList,
    },
    {
      href: '/companies',
      label: 'Target List',
      icon: Building2,
      // Active for /companies (without hotlist), /companies/[id], /companies/[id]/edit
      // but NOT /companies/new (has its own item) and NOT when hotlist is active
      active: !isHotList && pathname.startsWith('/companies') && pathname !== '/companies/new',
    },
    {
      href: '/compare',
      label: 'Compare',
      icon: BarChart3,
      active: pathname.startsWith('/compare'),
    },
    {
      href: '/newsletter',
      label: 'Newsletter',
      icon: Newspaper,
      active: pathname.startsWith('/newsletter'),
    },
  ]

  return (
    <nav className="px-2 py-3 space-y-0.5 shrink-0">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-3 px-2 py-2 rounded-full text-sm transition-colors duration-[2000ms]',
            active
              ? 'bg-acc-blue/15 text-acc-blue font-medium'
              : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5',
          )}
          title={!sidebarOpen ? label : undefined}
        >
          <Icon size={18} className="shrink-0" />
          {sidebarOpen && <span className="truncate font-medium">{label}</span>}
        </Link>
      ))}

      {/* Back to the newsroom. A plain <a>, not next/link: ACC360 is mounted
          under /360 by a dev-server proxy, so "/" is the newsroom at the proxy
          root — a client-side route transition would try to resolve it inside
          this app and 404. A full navigation hands it to the proxy. */}
      <a
        href="/"
        className={cn(
          'flex items-center gap-3 px-2 py-2 rounded-full text-sm transition-colors duration-[2000ms]',
          'text-foreground/60 hover:text-foreground hover:bg-foreground/5',
        )}
        title={!sidebarOpen ? 'Back to ACC' : undefined}
      >
        <ArrowLeft size={18} className="shrink-0" />
        {sidebarOpen && <span className="truncate font-medium">Back to ACC</span>}
      </a>

      {/* Add Company — admin only */}
      {isAdmin && (
        <Link
          href="/companies/new"
          className={cn(
            'flex items-center gap-3 px-2 py-2 rounded-full text-sm transition-colors duration-[2000ms]',
            pathname === '/companies/new'
              ? 'bg-acc-blue/15 text-acc-blue font-medium'
              : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5',
          )}
          title={!sidebarOpen ? 'Add Company' : undefined}
        >
          <Plus size={18} className="shrink-0" />
          {sidebarOpen && <span className="font-medium">Add Company</span>}
        </Link>
      )}
    </nav>
  )
}

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useApp()
  const { user } = useUser()

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'User'

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={toggleSidebar} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full bg-sidebar flex flex-col z-30 transition-all duration-[2000ms] ease-in-out border-r border-border',
        sidebarOpen ? 'w-64' : 'w-16',
      )}>
        {/* Brand wordmark */}
        <div className="flex items-center h-16 px-3 border-b border-border shrink-0">
          {sidebarOpen ? (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="flex items-center gap-2 font-sans text-sm font-bold leading-none tracking-[0.35em] text-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-acc-blue" />
                ACC
              </p>
              <p className="mt-1.5 font-mono text-[9px] uppercase leading-none tracking-[0.28em] text-foreground/50">
                Intelligence Hub
              </p>
            </div>
          ) : (
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-acc-blue" />
          )}
          <button
            onClick={toggleSidebar}
            className="ml-auto shrink-0 rounded-md p-1 text-foreground/50 transition-colors duration-[2000ms] hover:bg-foreground/5 hover:text-foreground"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Nav — wrapped in Suspense for useSearchParams */}
        <Suspense fallback={<div className="px-2 py-3 space-y-0.5" />}>
          <NavItems sidebarOpen={sidebarOpen} />
        </Suspense>

        {/* Bottom user area */}
        <div className={cn(
          'border-t border-border p-3 shrink-0 flex items-center mt-auto',
          sidebarOpen ? 'gap-3' : 'justify-center',
        )}>
          <UserButton afterSignOutUrl="/sign-in" />
          {sidebarOpen && <p className="text-xs font-light text-muted truncate">{displayName}</p>}
        </div>
      </aside>
    </>
  )
}
