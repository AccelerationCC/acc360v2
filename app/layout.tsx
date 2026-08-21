import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'ACC Intelligence',
  description: 'Internal company intelligence platform for The Acceleration Company',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInForceRedirectUrl="/" signUpForceRedirectUrl="/">
      <html lang="en" suppressHydrationWarning>
        <body>
          {children}
          <Toaster
            position="top-right"
            gutter={8}
            toastOptions={{
              duration: 4000,
              // Cream card + dark ink, matching the newsroom's surface card.
              style: {
                background: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: 'var(--color-acc-blue)', secondary: 'var(--card)' } },
              error:   { iconTheme: { primary: 'var(--destructive)', secondary: 'var(--card)' } },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}
