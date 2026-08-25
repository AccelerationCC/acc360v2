import { AppProvider } from '@/contexts/AppContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { MainContent } from '@/components/layout/MainContent'
import { ChatPanelGuard } from '@/components/layout/ChatPanelGuard'
import { ensureExecPage } from '@/lib/execGuard'

/**
 * Every dashboard page passes through here, so this is the one place the 360
 * tier is enforced for VIEWING.
 *
 * Before this, there was no such gate: middleware.ts calls auth().protect(),
 * which is authentication only, and the read APIs checked userId alone — so
 * any signed-in account, including `hr` or one with no role at all, could
 * browse the whole dashboard and read real company data. The role model was
 * enforced on writes and on the newsroom's nav item, but not here.
 *
 * Server-side and before any content renders: ensureExecPage redirects a
 * wrong-tier user to /no-access rather than letting the page paint first.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await ensureExecPage()

  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <MainContent>{children}</MainContent>
        <ChatPanelGuard />
      </div>
    </AppProvider>
  )
}
