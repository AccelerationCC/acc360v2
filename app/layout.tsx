import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'ACC Intelligence',
  description: 'Internal company intelligence platform for The Acceleration Company',
}

// Where Clerk sends a user after sign-in/sign-up. Was hardcoded "/", which is
// outside the app once basePath is set — every successful sign-in landed on a
// 404. Next does NOT rewrite these props for basePath (they are strings it
// never sees as routes), so they have to be built from the same value.
// Unset basePath keeps the old behaviour exactly: "/".
const HOME_URL = process.env.NEXT_PUBLIC_BASE_PATH || '/'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInForceRedirectUrl={HOME_URL} signUpForceRedirectUrl={HOME_URL}>
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
