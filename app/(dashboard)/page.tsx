'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AccLogo } from '@/components/ui/AccLogo'
import { useRouter } from 'next/navigation'
import { Building2, Plus, GitCompare, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MarkdownContent } from '@/components/ui/MarkdownContent'
import { generateId } from '@/lib/utils'
import { useStatusMessages } from '@/lib/hooks/useStatusMessages'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { ChatMessage } from '@/types'

const QUICK_QUESTIONS = [
  'Build me a chart comparing all Hot List companies by revenue',
  'What is the highest revenue company?',
  'What is a company we should consider acquiring?',
  'Compare top 3 by funding round',
]

export default function HomePage() {
  const router = useRouter()
  const { isAdmin } = useAdmin()

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [asked, setAsked] = useState(false)

  // Show rotating status while waiting for first text token
  const statusActive = loading && !streamContent
  const statusMessage = useStatusMessages(statusActive)

  async function ask(question: string) {
    if (!question.trim() || loading) return
    setAsked(true)
    setLoading(true)
    setStreamContent('')

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error ?? `Request failed (${res.status})`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setStreamContent(accumulated)
      }

      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'assistant', content: accumulated, timestamp: new Date() },
      ])
      setStreamContent('')
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: err.message || 'Connection error — please try again.',
          timestamp: new Date(),
        },
      ])
      setStreamContent('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!asked ? (
        /* ── Hero state ── */
        <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
          <div className="w-full max-w-2xl text-center">
          <div className="flex justify-center mb-4">
            <AccLogo className="w-full max-w-[500px]" />
          </div>

          <p className="font-light text-muted mb-8 sm:mb-10 text-base sm:text-lg">
            Welcome to Acceleration&apos;s Intelligence Hub
          </p>

          <div className="relative flex items-end gap-2 bg-card border border-border rounded-[10px] p-3 focus-within:border-acc-blue/50 transition-colors duration-[1200ms]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) }
              }}
              placeholder="Ask MOAA a question..."
              rows={2}
              className="flex-1 bg-transparent text-foreground placeholder-muted text-base font-light focus:outline-none resize-none leading-relaxed min-h-[56px]"
            />
            <button
              onClick={() => ask(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 w-10 h-10 rounded-lg bg-acc-blue hover:opacity-90 text-white flex items-center justify-center transition-all duration-[1200ms] disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 hover:shadow-md hover:shadow-acc-blue/30"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted hover:text-foreground hover:bg-card hover:border-acc-blue/40 active:scale-[0.97] transition-all duration-[1200ms]"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-8 sm:mt-12">
            {[
              { href: '/companies', icon: Building2, label: 'Browse Companies', desc: 'View all records' },
              ...(isAdmin ? [{ href: '/companies/new', icon: Plus, label: 'Add Company', desc: 'Create a new record' }] : []),
              { href: '/compare', icon: GitCompare, label: 'Compare', desc: 'Side-by-side view' },
            ].map((item, i, arr) => {
              const Icon = item.icon
              const isLastOdd = i === arr.length - 1 && arr.length % 2 !== 0
              const inner = (
                <div className="flex flex-col items-center gap-2 p-4 rounded-[10px] border border-border bg-card hover:border-acc-blue/40 hover:bg-foreground/[0.03] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5 active:scale-[0.98] active:translate-y-0 transition-all duration-[1200ms] cursor-pointer text-center">
                  <div className="w-9 h-9 rounded-lg bg-acc-blue/10 flex items-center justify-center group-hover:bg-acc-blue/20 transition-colors duration-[1200ms]">
                    <Icon size={18} className="text-acc-blue" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] font-light text-muted">{item.desc}</p>
                  </div>
                </div>
              )
              const colClass = isLastOdd ? 'group col-span-2 sm:col-span-1 flex justify-center' : 'group'
              const innerWrapped = isLastOdd ? <div className="w-1/2 sm:w-full">{inner}</div> : inner
              return (
                <Link key={item.label} href={item.href} className={colClass}>
                  {innerWrapped}
                </Link>
              )
            })}
          </div>
        </div>
        </div>
      ) : (
        /* ── Chat result state ── */
        <div className="flex min-h-[calc(100vh-104px)] w-full flex-col px-0 sm:px-4">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <div className="flex items-center gap-3 py-2 sm:py-3">
            <h1 className="font-sans text-sm font-medium tracking-normal text-foreground">MOAA 2.1</h1>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => { setAsked(false); setMessages([]); setStreamContent('') }}
            >
              New question
            </Button>
          </div>

          <div className="flex-1 space-y-8 py-8 sm:py-10">
            {/* Completed messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                {msg.role === 'user' ? (
                  <span className="inline-block max-w-[80%] rounded-[18px] bg-acc-blue/10 px-4 py-2.5 text-sm font-light text-foreground sm:max-w-[70%]">
                    {msg.content}
                  </span>
                ) : (
                  <div className="max-w-3xl text-foreground">
                    <MarkdownContent>{msg.content}</MarkdownContent>
                  </div>
                )}
              </div>
            ))}

            {/* In-progress streaming bubble */}
            {loading && (
              <div className="flex justify-start">
                <div className="relative max-w-3xl text-foreground">
                  {streamContent ? (
                    <>
                      <MarkdownContent>{streamContent}</MarkdownContent>
                      {/* live indicator */}
                      <span className="absolute -right-4 top-2 h-1.5 w-1.5 rounded-full bg-acc-blue animate-pulse" />
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted text-sm py-0.5">
                      <Loader2 size={13} className="animate-spin shrink-0" />
                      <span>{statusMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Follow-up input */}
          <div className="sticky bottom-0 bg-background py-3 sm:py-4">
            <div className="relative flex items-end gap-2 rounded-[18px] border border-border bg-card p-3 shadow-lg shadow-foreground/5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) }
                }}
                placeholder="Ask a follow-up…"
                rows={1}
                disabled={loading}
                className="min-h-[40px] flex-1 resize-none bg-transparent text-sm font-light text-foreground placeholder-muted focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => ask(input)}
                disabled={!input.trim() || loading}
                className="shrink-0 w-9 h-9 rounded-lg bg-acc-blue hover:opacity-90 text-white flex items-center justify-center transition-all duration-[1200ms] disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 hover:shadow-md hover:shadow-acc-blue/30"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  )
}
