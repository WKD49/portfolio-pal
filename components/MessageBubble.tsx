'use client'

import { marked } from 'marked'
import { Message } from '@/lib/types'

interface Props {
  message: Message
  isStreaming?: boolean
}

interface PortfolioResponse {
  portfolioAssessment?: string
  rotationalSuggestions?: string
  logEntry?: unknown
}

// marked v17 — configure via marked.use(), not the deprecated setOptions
marked.use({ async: false, gfm: true })

function renderSection(text: string): string {
  if (!text) return ''
  // Ensure blank line before lists and bold-only lines
  const normalised = text
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\n([-*] )/g, '$1\n\n$2')
    .replace(/([^\n])\n(\d+\. )/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const html = marked.parse(normalised) as string
  // Remove any unpaired ** that marked left as literals
  return html.replace(/\*\*/g, '')
}

function tryParseResponse(content: string): PortfolioResponse | null {
  if (!content.trim().startsWith('{')) return null
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && ('portfolioAssessment' in parsed || 'rotationalSuggestions' in parsed)) {
      return parsed as PortfolioResponse
    }
    return null
  } catch {
    return null
  }
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--accent)',
  fontFamily: 'Arial, sans-serif',
  fontWeight: 600,
  marginBottom: '0.6rem',
  marginTop: '1.5rem',
}

export default function MessageBubble({ message, isStreaming }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div
          style={{
            background: 'var(--user-bubble)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            maxWidth: '72%',
            borderRadius: '12px 12px 2px 12px',
            padding: '0.75rem 1.1rem',
            fontSize: '0.925rem',
            lineHeight: '1.6',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  // Show loading state while streaming (accumulating JSON)
  if (isStreaming) {
    return (
      <div className="mb-8">
        <div
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: '0.6rem',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 600,
          }}
        >
          Portfolio Pal
        </div>
        <div
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'italic',
          }}
        >
          Analysing your portfolio
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '14px',
              background: 'var(--accent)',
              borderRadius: '1px',
              marginLeft: '4px',
              verticalAlign: 'text-bottom',
              animation: 'blink 1s step-end infinite',
            }}
          />
        </div>
        <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      </div>
    )
  }

  // Try to parse as structured JSON response
  const structured = tryParseResponse(message.content)

  if (structured) {
    return (
      <div className="mb-8">
        <div
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: '0.6rem',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 600,
          }}
        >
          Portfolio Pal
        </div>

        {structured.portfolioAssessment && (
          <>
            <div style={{ ...sectionHeadingStyle, marginTop: 0 }}>Portfolio Assessment</div>
            <div
              className="prose-pal"
              style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}
              dangerouslySetInnerHTML={{ __html: renderSection(structured.portfolioAssessment) }}
            />
          </>
        )}

        {structured.rotationalSuggestions && (
          <>
            <div style={sectionHeadingStyle}>Rotational Suggestions</div>
            <div
              className="prose-pal"
              style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}
              dangerouslySetInnerHTML={{ __html: renderSection(structured.rotationalSuggestions) }}
            />
          </>
        )}
      </div>
    )
  }

  // Fallback: plain text render (for error messages, older messages, etc.)
  return (
    <div className="mb-8">
      <div
        style={{
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          marginBottom: '0.6rem',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 600,
        }}
      >
        Portfolio Pal
      </div>
      <div
        style={{
          fontSize: '0.95rem',
          color: 'var(--text-primary)',
          fontFamily: 'Arial, sans-serif',
          lineHeight: '1.65',
          whiteSpace: 'pre-wrap',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}
