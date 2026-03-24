'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, RotateCcw, UserCircle, BarChart2 } from 'lucide-react'
import { Message, LogEntry, UserProfile } from '@/lib/types'
import { MAX_USER_MSG_CHARS } from '@/lib/guardrails'
import { buildPortfolioContextBlock, buildPortfolioTrace, AccountTrace } from '@/lib/context-builder'
import MessageBubble from './MessageBubble'
import LogSidebar from './LogSidebar'
import PortfolioInspector from './PortfolioInspector'

function formatUserProfile(p: UserProfile): string {
  const lines: string[] = ['--- USER PROFILE ---']
  lines.push(`Base currency: ${p.baseCurrency}`)
  if (p.age) lines.push(`Age: ${p.age}`)
  lines.push(`Risk tolerance: ${p.riskTolerance} / 10`)
  lines.push(`Time horizon: ${p.timeHorizon}`)
  if (p.goals.length > 0) {
    const goalLabels = p.goals.map((g) =>
      g === 'Something else' && p.goalsOther ? p.goalsOther : g
    )
    lines.push(`Goals: ${goalLabels.join(', ')}`)
  }
  lines.push(`Draws income: ${p.drawsIncome ? `Yes — from: ${p.incomeStartDate || 'unspecified'}` : 'No'}`)
  if (p.individualPositionsPct && parseFloat(p.individualPositionsPct) > 0) {
    lines.push(`Individual positions pot: ~${p.individualPositionsPct}% of total portfolio`)
  }
  lines.push('')
  lines.push('Accounts:')
  p.accounts.forEach((a, i) => {
    const label = a.description?.trim() ? `${a.description} (${a.taxWrapper})` : a.taxWrapper
    lines.push(`${i + 1}. ${label}`)
    const alloc = a.allocation
      .filter(item => item.name && item.percentage)
      .map(item => `${item.name} ${item.percentage}%`)
      .join(', ')
    if (alloc) lines.push(`   Holdings: ${alloc}`)
  })
  if (p.marketNotes) {
    lines.push('')
    lines.push(`[QUALITATIVE MARKET CONTEXT — user-provided interpretation of current conditions]`)
    lines.push(p.marketNotes)
  }
  lines.push('--- END PROFILE ---')
  return lines.join('\n')
}

interface ChatInterfaceProps {
  userProfile?: UserProfile
  onEditProfile?: () => void
  onNewSession?: () => void
}

function extractLogEntry(text: string): Omit<LogEntry, 'id' | 'date'> | null {
  // Primary path: structured JSON response
  if (text.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed?.logEntry && typeof parsed.logEntry === 'object') {
        return parsed.logEntry as Omit<LogEntry, 'id' | 'date'>
      }
    } catch { /* fall through */ }
  }
  // Legacy fallback: markdown log-entry code block
  const match = text.match(/```log-entry\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export default function ChatInterface({ userProfile, onEditProfile, onNewSession }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [logRefresh, setLogRefresh] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [logWarning, setLogWarning] = useState<string | null>(null)
  const [macroContext, setMacroContext] = useState<string | null>(null)
  const [macroWarning, setMacroWarning] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [portfolioTrace, setPortfolioTrace] = useState<AccountTrace[] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)

  // On mount: load log, fetch macro context, then trigger initial assessment.
  // Portfolio structure block is built client-side from the profile.
  // Macro fetch completes first so the very first AI call has live data.
  useEffect(() => {
    fetch('/api/log')
      .then((r) => r.json())
      .then(setLogEntries)
      .catch(() => {})

    if (initialized.current) return
    initialized.current = true

    // Build portfolio structure context from the user's profile (no £ values sent)
    const portfolioBlock = userProfile ? buildPortfolioContextBlock(userProfile) : null
    if (userProfile) {
      setPortfolioTrace(buildPortfolioTrace(userProfile))
    }

    const initial: Message[] = userProfile
      ? [{ role: 'user', content: formatUserProfile(userProfile) }]
      : []
    setMessages([])

    fetch('/api/macro')
      .then((r) => r.json())
      .then((data) => {
        if (data.contextBlock) {
          setMacroContext(data.contextBlock)
          if (data.warnings?.length > 0) {
            setMacroWarning(`Macro data: ${data.warnings.length} indicator(s) unavailable or stale.`)
          }
          sendToAI(initial, [], data.contextBlock, portfolioBlock)
        } else {
          setMacroWarning(data.error ?? 'Macro data unavailable — using manual context only.')
          sendToAI(initial, [], null, portfolioBlock)
        }
      })
      .catch(() => {
        setMacroWarning('Could not reach macro data service.')
        sendToAI(initial, [], null, portfolioBlock)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveLogEntry = useCallback(async (partial: Omit<LogEntry, 'id' | 'date'>) => {
    const entry: LogEntry = {
      ...partial,
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
    }
    // Rule 11 — check server-side validation result and warn the user if it fails
    const res = await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setLogWarning(
        err.error ?? 'The recommendation could not be saved to the log. It has not been recorded.'
      )
      return
    }
    setLogEntries((prev) => [...prev, entry])
    setLogRefresh((n) => n + 1)
  }, [setLogWarning])

  async function sendToAI(currentMessages: Message[], currentLog: LogEntry[], macro: string | null, portfolioBlock?: string | null) {
    setIsStreaming(true)
    setError(null)

    // Add placeholder for streaming message.
    // Always update the LAST message (the placeholder just added) — do not
    // derive an index from currentMessages.length, which may not match the
    // actual messages state when setMessages([]) was called before sendToAI.
    const placeholder: Message = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, placeholder])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentMessages, logContext: currentLog, macroContext: macro, portfolioContext: portfolioBlock ?? null }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Unknown error')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              fullText += delta
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullText }
                return updated
              })
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      // Check for a log entry embedded in the response
      const logData = extractLogEntry(fullText)
      if (logData) {
        await saveLogEntry(logData)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setMessages((prev) => prev.slice(0, -1)) // remove placeholder
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    // Rule 17 — client-side defence-in-depth: truncate before sending
    let content = trimmed
    if (content.length > MAX_USER_MSG_CHARS) {
      content = content.slice(0, MAX_USER_MSG_CHARS)
      setLogWarning('Your message was very long and has been trimmed to fit the token budget.')
    } else {
      setLogWarning(null)
    }

    const userMessage: Message = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')

    const portfolioBlock = userProfile ? buildPortfolioContextBlock(userProfile) : null
    await sendToAI(newMessages, logEntries, macroContext, portfolioBlock)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleNewSession() {
    setMessages([])
    initialized.current = false
    setTimeout(() => {
      initialized.current = true
      sendToAI([], logEntries, macroContext)
    }, 50)
  }

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 600,
              marginBottom: '0.1rem',
            }}
          >
            Portfolio Pal
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            Macro-aware portfolio rotation advisor
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {portfolioTrace && (
            <button
              onClick={() => setShowInspector(true)}
              disabled={isStreaming}
              title="View calculations"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.4rem 0.75rem',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.72rem',
                fontFamily: 'Arial, sans-serif',
                letterSpacing: '0.04em',
                opacity: isStreaming ? 0.5 : 1,
              }}
            >
              <BarChart2 size={12} />
              View calculations
            </button>
          )}
          {onEditProfile && (
            <button
              onClick={onEditProfile}
              disabled={isStreaming}
              title="Edit profile"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.4rem 0.75rem',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.72rem',
                fontFamily: 'Arial, sans-serif',
                letterSpacing: '0.04em',
                opacity: isStreaming ? 0.5 : 1,
              }}
            >
              <UserCircle size={12} />
              Edit profile
            </button>
          )}
          <button
            onClick={() => onNewSession ? onNewSession() : handleNewSession()}
            disabled={isStreaming}
            title="New session"
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.72rem',
              fontFamily: 'Arial, sans-serif',
              letterSpacing: '0.04em',
              opacity: isStreaming ? 0.5 : 1,
            }}
          >
            <RotateCcw size={12} />
            New session
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2rem',
          maxWidth: '820px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}

        {/* Initial loading state */}
        {messages.length === 0 && isStreaming && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontFamily: 'Arial, sans-serif',
              marginTop: '2rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '14px',
                background: 'var(--accent)',
                borderRadius: '1px',
                animation: 'blink 1s step-end infinite',
              }}
            />
            <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(220,60,60,0.1)',
              border: '1px solid rgba(220,60,60,0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: '#e07070',
              fontSize: '0.85rem',
              fontFamily: 'Arial, sans-serif',
              marginBottom: '1rem',
            }}
          >
            {error.includes('OPENAI_API_KEY') ? (
              <>
                <strong>API key not set.</strong> Create a <code>.env.local</code> file in the project
                root with <code>OPENAI_API_KEY=your-key</code> and restart the server.
              </>
            ) : (
              error
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '1rem 2rem 1.25rem',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: '820px',
            margin: '0 auto',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Reply to Portfolio Pal…"
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.7rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'Arial, sans-serif',
              resize: 'none',
              outline: 'none',
              lineHeight: '1.5',
              minHeight: '42px',
              maxHeight: '160px',
              overflow: 'auto',
              opacity: isStreaming ? 0.6 : 1,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            style={{
              background: isStreaming || !input.trim() ? 'var(--bg-surface)' : 'var(--accent)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.7rem',
              cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
              color: isStreaming || !input.trim() ? 'var(--text-muted)' : '#0d0f14',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Send size={16} />
          </button>
        </div>
        {logWarning && (
          <div
            style={{
              maxWidth: '820px',
              margin: '0.5rem auto 0',
              background: 'rgba(200,150,30,0.1)',
              border: '1px solid rgba(200,150,30,0.35)',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              color: '#c8960f',
              fontSize: '0.78rem',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            {logWarning}
          </div>
        )}
        <div
          style={{
            maxWidth: '820px',
            margin: '0.5rem auto 0',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          Enter to send · Shift+Enter for new line · This is not financial advice
          {macroContext
            ? ' · Macro data: live'
            : macroWarning
              ? ` · ⚠ ${macroWarning}`
              : ' · Macro data: loading…'}
        </div>
      </div>

      {/* Log sidebar */}
      <LogSidebar refreshTrigger={logRefresh} />

      {showInspector && portfolioTrace && (
        <PortfolioInspector trace={portfolioTrace} onClose={() => setShowInspector(false)} />
      )}
    </div>
  )
}
