'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react'
import { MarkdownContent } from '@/components/ui/MarkdownContent'
import { cn, generateId } from '@/lib/utils'
import { useApp } from '@/contexts/AppContext'
import { useStatusMessages } from '@/lib/hooks/useStatusMessages'
import { ChatMessage } from '@/types'

export function ChatPanel() {
  const { chatOpen, toggleChat, allCompanies, companiesReady } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const statusActive = loading && !streamContent
  const statusMessage = useStatusMessages(statusActive)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent, loading])

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [chatOpen])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setStreamContent('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
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
          content: err.message || 'Connection error. Please check your network and try again.',
          timestamp: new Date(),
        },
      ])
      setStreamContent('')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {chatOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 sm:hidden" onClick={toggleChat} />
      )}

      {/* Floating trigger button */}
      <button
        onClick={toggleChat}
        className={cn(
          'fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 w-13 h-13 p-3.5 rounded-full transition-all duration-[600ms]',
          'bg-acc-blue hover:opacity-90 hover:shadow-lg hover:shadow-acc-blue/30 text-white active:scale-95',
          chatOpen && 'scale-90 opacity-0 pointer-events-none'
        )}
        aria-label="Open AI chat"
      >
        <MessageSquare size={22} />
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          'fixed z-40 flex flex-col',
          'bg-sidebar border border-border overflow-hidden',
          'transition-all duration-[800ms]',
          'bottom-0 left-0 right-0 rounded-t-2xl rounded-b-none h-[80vh]',
          'sm:bottom-6 sm:left-auto sm:right-6 sm:w-[380px] sm:h-[560px] sm:max-h-[calc(100vh-100px)] sm:rounded-[10px]',
          chatOpen
            ? 'opacity-100 pointer-events-auto translate-y-0 sm:scale-100'
            : 'opacity-0 pointer-events-none translate-y-full sm:translate-y-0 sm:scale-90'
        )}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-acc-blue/10">
            <Bot size={16} className="text-acc-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">MOAA</p>
            <p className="text-xs font-light text-muted truncate">Your trusted AI Assistant.</p>
          </div>
          <button
            onClick={toggleChat}
            className="p-1 rounded-md text-muted hover:text-foreground hover:bg-card transition-colors duration-[800ms] shrink-0"
            aria-label="Close chat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
              <div className="w-12 h-12 rounded-[10px] bg-acc-blue/10 flex items-center justify-center">
                <Bot size={24} className="text-acc-blue" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Hey there, I&apos;m MOAA!</p>
                <p className="text-xs font-light text-muted mt-1 leading-relaxed">
                  {companiesReady
                    ? `${allCompanies.length} companies loaded. You can ask me just about anything, For example, try: "Which company has the highest revenue?".`
                    : 'Loading company data…'}
                </p>
              </div>
            </div>
          )}

          {/* Completed messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
            >
              <div
                className={cn(
                  'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5',
                  msg.role === 'user' ? 'bg-acc-blue/20' : 'bg-muted-ink/20'
                )}
              >
                {msg.role === 'user' ? (
                  <User size={13} className="text-acc-blue" />
                ) : (
                  <Bot size={13} className="text-muted-ink" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[80%] rounded-[10px] px-3 py-2 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-acc-blue/10 text-foreground rounded-tr-sm'
                    : 'bg-card text-foreground rounded-tl-sm'
                )}
              >
                {msg.role === 'assistant' ? (
                  <MarkdownContent>{msg.content}</MarkdownContent>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {/* In-progress streaming bubble */}
          {loading && (
            <div className="flex gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-muted-ink/20 flex items-center justify-center mt-0.5">
                <Bot size={13} className="text-muted-ink" />
              </div>
              <div className="max-w-[80%] rounded-[10px] rounded-tl-sm px-3 py-2 bg-card text-foreground relative">
                {streamContent ? (
                  <>
                    <MarkdownContent>{streamContent}</MarkdownContent>
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-acc-blue animate-pulse" />
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted py-0.5">
                    <Loader2 size={12} className="animate-spin shrink-0" />
                    <span className="text-xs">{statusMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              disabled={loading || !companiesReady}
              className={cn(
                'flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-light text-foreground placeholder-muted',
                'focus:outline-none focus:ring-1 focus:ring-acc-blue resize-none min-h-[40px] max-h-[120px] transition-colors duration-[800ms]',
                'disabled:opacity-50'
              )}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading || !companiesReady}
              className="shrink-0 w-9 h-9 rounded-lg bg-acc-blue hover:opacity-90 text-white flex items-center justify-center transition-colors duration-[800ms] disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-[10px] font-light text-muted mt-1.5 text-center">
            Powered by Claude & AirTable.
          </p>
        </div>
      </div>
    </>
  )
}
