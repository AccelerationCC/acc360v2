import { AppProvider } from '@/contexts/AppContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { MainContent } from '@/components/layout/MainContent'
import { ChatPanelGuard } from '@/components/layout/ChatPanelGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
