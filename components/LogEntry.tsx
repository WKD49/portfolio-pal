'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { LogEntry as LogEntryType } from '@/lib/types'

interface Props {
  entry: LogEntryType
  onUpdateOutcome: (id: string, outcome: string, verdict: string) => void
}

export default function LogEntry({ entry, onUpdateOutcome }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editingOutcome, setEditingOutcome] = useState(false)
  const [outcome, setOutcome] = useState(entry.outcome ?? '')
  const [verdict, setVerdict] = useState(entry.verdict ?? '')

  const status = entry.outcome ? 'acted' : 'pending'

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.3rem',
            }}
          >
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'Arial, sans-serif',
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
              }}
            >
              {entry.date}
            </span>
            <span
              style={{
                fontSize: '0.6rem',
                padding: '0.1rem 0.5rem',
                borderRadius: '10px',
                fontFamily: 'Arial, sans-serif',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: status === 'acted' ? 'rgba(74,197,120,0.12)' : 'rgba(201,168,76,0.12)',
                color: status === 'acted' ? '#4ac578' : 'var(--accent)',
                border: `1px solid ${status === 'acted' ? 'rgba(74,197,120,0.25)' : 'rgba(201,168,76,0.25)'}`,
              }}
            >
              {status === 'acted' ? 'outcome logged' : 'pending'}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              fontFamily: 'Arial, sans-serif',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {entry.rotationSuggested}
          </p>
        </div>
        <div style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            padding: '0 1rem 1rem',
            borderTop: '1px solid var(--border)',
            paddingTop: '0.75rem',
          }}
        >
          <Field label="Currency" value={`${entry.baseCurrency} — ${entry.fxConditions}`} />
          <Field label="Market context" value={entry.marketContext} />
          <Field label="Reasoning" value={entry.reasoning} />

          {entry.outcome && <Field label="Outcome" value={entry.outcome} highlight />}
          {entry.verdict && <Field label="Verdict" value={entry.verdict} />}

          {/* Add outcome button */}
          {!entry.outcome && !editingOutcome && (
            <button
              onClick={() => setEditingOutcome(true)}
              style={{
                marginTop: '0.75rem',
                fontSize: '0.7rem',
                fontFamily: 'Arial, sans-serif',
                color: 'var(--accent)',
                background: 'none',
                border: '1px solid var(--accent)',
                borderRadius: '4px',
                padding: '0.3rem 0.7rem',
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              + Add outcome
            </button>
          )}

          {editingOutcome && (
            <div style={{ marginTop: '0.75rem' }}>
              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What happened? Did you act on it?"
                rows={2}
                style={{
                  width: '100%',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.5rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'Arial, sans-serif',
                  resize: 'vertical',
                  outline: 'none',
                  marginBottom: '0.4rem',
                }}
              />
              <textarea
                value={verdict}
                onChange={(e) => setVerdict(e.target.value)}
                placeholder="Verdict — was the reasoning sound?"
                rows={2}
                style={{
                  width: '100%',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.5rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'Arial, sans-serif',
                  resize: 'vertical',
                  outline: 'none',
                  marginBottom: '0.5rem',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    onUpdateOutcome(entry.id, outcome, verdict)
                    setEditingOutcome(false)
                  }}
                  style={{
                    fontSize: '0.7rem',
                    fontFamily: 'Arial, sans-serif',
                    background: 'var(--accent)',
                    color: '#0d0f14',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.3rem 0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingOutcome(false)}
                  style={{
                    fontSize: '0.7rem',
                    fontFamily: 'Arial, sans-serif',
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '0.3rem 0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div
        style={{
          fontSize: '0.6rem',
          fontFamily: 'Arial, sans-serif',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '0.15rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '0.8rem',
          fontFamily: 'Arial, sans-serif',
          color: highlight ? '#4ac578' : 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  )
}
