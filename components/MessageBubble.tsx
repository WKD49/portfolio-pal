'use client'

import { Message } from '@/lib/types'

interface Props {
  message: Message
  isStreaming?: boolean
}

function renderMarkdown(text: string): string {
  return (
    text
      // Section headers like "**MACRO ASSESSMENT**" → styled h2
      .replace(/^\*\*([A-Z][A-Z\s]+)\*\*$/gm, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr/>')
      // Unordered list items
      .replace(/^[-•]\s(.+)/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
      // Paragraphs — wrap lines that aren't already HTML tags
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return ''
        if (/^<(h[1-6]|ul|ol|li|hr|blockquote)/.test(trimmed)) return trimmed
        return `<p>${trimmed}</p>`
      })
      .filter(Boolean)
      .join('\n')
  )
}

// Strip the log-entry JSON block from the displayed message
function stripLogEntry(text: string): string {
  return text.replace(/```log-entry[\s\S]*?```/g, '').trim()
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

  const displayContent = stripLogEntry(message.content)
  const html = renderMarkdown(displayContent)

  return (
    <div className="mb-8">
      {/* Advisor label */}
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
        className="prose-pal"
        style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isStreaming && (
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '16px',
            background: 'var(--accent)',
            marginLeft: '2px',
            borderRadius: '1px',
            animation: 'blink 1s step-end infinite',
          }}
        />
      )}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
