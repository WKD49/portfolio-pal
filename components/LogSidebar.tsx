'use client'

import { useState, useEffect } from 'react'
import { BookOpen, X } from 'lucide-react'
import { LogEntry as LogEntryType } from '@/lib/types'
import LogEntry from './LogEntry'

interface Props {
  refreshTrigger: number
}

export default function LogSidebar({ refreshTrigger }: Props) {
  const [entries, setEntries] = useState<LogEntryType[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/log')
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {})
  }, [refreshTrigger])

  async function handleUpdateOutcome(id: string, outcome: string, verdict: string) {
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    const updated = { ...entry, outcome, verdict }
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setOpen(!open)}
        title="Recommendation log"
        style={{
          position: 'fixed',
          top: '1.25rem',
          right: open ? '18rem' : '1.25rem',
          zIndex: 50,
          background: open ? 'var(--bg-surface)' : 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '0.5rem 0.75rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          fontFamily: 'Arial, sans-serif',
          letterSpacing: '0.04em',
          transition: 'right 0.25s ease',
        }}
      >
        {open ? <X size={14} /> : <BookOpen size={14} />}
        {open ? 'Close' : `Log${entries.length ? ` (${entries.length})` : ''}`}
      </button>

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: '18rem',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1rem 0.75rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 600,
              marginBottom: '0.2rem',
            }}
          >
            Recommendation Log
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Arial, sans-serif' }}>
            {entries.length === 0
              ? 'No recommendations yet'
              : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
          </div>
        </div>

        <div style={{ padding: '0.75rem', flex: 1 }}>
          {sorted.length === 0 ? (
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                fontFamily: 'Arial, sans-serif',
                lineHeight: 1.6,
                marginTop: '1rem',
              }}
            >
              Recommendations will appear here once Portfolio Pal starts advising.
            </p>
          ) : (
            sorted.map((entry) => (
              <LogEntry key={entry.id} entry={entry} onUpdateOutcome={handleUpdateOutcome} />
            ))
          )}
        </div>
      </div>
    </>
  )
}
