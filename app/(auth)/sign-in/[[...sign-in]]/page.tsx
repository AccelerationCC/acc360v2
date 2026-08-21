'use client'

import { useState, FormEvent } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-acc-blue mb-4">
          <span className="text-2xl font-bold text-navy">A</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">ACC Intelligence</h1>
        <p className="text-muted text-sm mt-1">Internal access only</p>
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
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !isLoaded}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-acc-blue hover:bg-orange-500 text-navy font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-xs text-muted text-center max-w-xs">
        Access is by invitation only. Contact your administrator if you need an account.
      </p>
    </div>
  )
}
