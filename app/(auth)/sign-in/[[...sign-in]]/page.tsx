'use client'

import { useState, FormEvent } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  EntranceEyebrow,
  EntranceGlows,
  EntranceHeadline,
  EntranceWordmark,
  GrainOverlay,
  WorldClockStrip,
} from '@/components/ui/entrance'

export default function SignInPage() {
  const { signIn, isLoaded, setActive } = useSignIn()
  const router = useRouter()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const inputClass =
    'w-full rounded-lg bg-surface border border-border text-foreground placeholder-muted px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-acc-blue focus:border-transparent transition-colors'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setError('')
    setLoading(true)

    try {
      const result = await signIn!.create({ identifier: email, password })

      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId! })
        router.push('/')
      } else {
        setError('Sign-in could not be completed. Please contact your administrator.')
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
      setError(msg ?? 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Layering, back to front: ambient glows, the grain film, then content —
    // the same order as client-newsroom's /sign-in, so the two doors match.
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <EntranceGlows />
      <GrainOverlay />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-between px-6 py-6">
        <header className="flex w-full items-center justify-between pt-2 animate-fade-up">
          <EntranceWordmark />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
            Secure Channel · Live
          </span>
        </header>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 py-10">
          <div className="flex animate-fade-up flex-col items-center text-center">
            <EntranceEyebrow>Restricted access · ACC360</EntranceEyebrow>
            <EntranceHeadline>Sign in</EntranceHeadline>
            <p className="mx-auto max-w-[300px] text-[13px] leading-relaxed text-foreground/70">
              Company intelligence for the ACC team. Contact your administrator if you need access.
            </p>
          </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 space-y-4">
        <h2 className="text-lg font-semibold text-foreground text-center mb-2">Sign in</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@theacceleration.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !isLoaded}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-acc-blue text-white hover:opacity-90 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        </form>

          <p className="max-w-xs text-center text-xs text-foreground/50">
            Access is by invitation only. Contact your administrator if you need an account.
          </p>
        </div>

        <div className="w-full animate-fade-up pb-2 [animation-delay:250ms]">
          <WorldClockStrip />
        </div>
      </div>
    </div>
  )
}
