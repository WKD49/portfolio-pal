'use client'

import { UserProfile } from '@/lib/types'
import { buildPortfolioContextBlock } from '@/lib/context-builder'

interface Props {
  profile: UserProfile
  onConfirm: () => void
  onBack: () => void
}

const SUBCLASS_CATEGORIES: Record<string, string> = {
  'US equity':                      '#4e8ef7',
  'UK equity':                      '#c9a84c',
  'European equity (ex-UK)':        '#7ecba1',
  'Global equity (developed)':      '#a78bfa',
  'Emerging markets equity':        '#fb923c',
  'Japanese equity':                '#f472b6',
  'Asia Pacific equity (ex-Japan)': '#34d399',
  'UK government bonds (gilts)':    '#60a5fa',
  'US government bonds':            '#93c5fd',
  'European government bonds':      '#6ee7b7',
  'Japanese government bonds':      '#d1fae5',
  'Global government bonds':        '#bfdbfe',
  'UK investment grade bonds':      '#fbbf24',
  'US investment grade bonds':      '#fde68a',
  'European investment grade bonds':'#fef3c7',
  'Global bonds (hedged)':          '#e5e7eb',
  'Inflation-linked bonds':         '#f3f4f6',
  'High yield bonds':               '#fee2e2',
  'Gold':                           '#fcd34d',
  'Copper':                         '#d97706',
  'Silver':                         '#9ca3af',
  'Energy commodities':             '#6b7280',
  'Broad commodities':              '#78716c',
  'Real estate':                    '#a78bfa',
  'Cash / money market':            '#d1d5db',
  'Other / unclassified':           '#374151',
}

function getColor(label: string): string {
  return SUBCLASS_CATEGORIES[label] ?? '#4b5563'
}

// Group sub-asset classes for display
const EQUITY_LABELS = ['US equity', 'UK equity', 'European equity (ex-UK)', 'Global equity (developed)', 'Emerging markets equity', 'Japanese equity', 'Asia Pacific equity (ex-Japan)']
const BOND_LABELS = ['UK government bonds (gilts)', 'US government bonds', 'European government bonds', 'Japanese government bonds', 'Global government bonds', 'UK investment grade bonds', 'US investment grade bonds', 'European investment grade bonds', 'Global bonds (hedged)', 'Inflation-linked bonds', 'High yield bonds']
const OTHER_LABELS = ['Gold', 'Copper', 'Silver', 'Energy commodities', 'Broad commodities', 'Real estate', 'Cash / money market', 'Other / unclassified']

export default function PortfolioSummary({ profile, onConfirm, onBack }: Props) {
  // Parse breakdown from context builder (reuse the same logic)
  const contextBlock = buildPortfolioContextBlock(profile)

  // Extract breakdown lines from context block
  const breakdown: Record<string, number> = {}
  const lines = contextBlock.split('\n')
  for (const line of lines) {
    const match = line.match(/^\s{2}(.+?):\s*([\d.]+)%$/)
    if (match) breakdown[match[1]] = parseFloat(match[2])
  }

  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1])

  const equityItems = sorted.filter(([k]) => EQUITY_LABELS.includes(k))
  const bondItems = sorted.filter(([k]) => BOND_LABELS.includes(k))
  const otherItems = sorted.filter(([k]) => OTHER_LABELS.includes(k))

  const equityTotal = equityItems.reduce((s, [, v]) => s + v, 0)
  const bondTotal = bondItems.reduce((s, [, v]) => s + v, 0)
  const otherTotal = otherItems.reduce((s, [, v]) => s + v, 0)

  const missingData = contextBlock.includes('No composition data provided for:')

  function Section({ title, total, items }: { title: string; total: number; items: [string, number][] }) {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', fontWeight: 600 }}>
            {title}
          </div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
            {total.toFixed(1)}%
          </div>
        </div>
        {items.map(([label, pct]) => (
          <div key={label} style={{ marginBottom: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>{pct.toFixed(1)}%</span>
            </div>
            <div style={{ height: '4px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: getColor(label), borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1.25rem 4rem',
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '0.35rem' }}>
            Portfolio Pal
          </div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            Your portfolio breakdown
          </div>
        </div>

        {/* Intro */}
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Here&apos;s how Portfolio Pal has understood your holdings. These sub-asset class percentages are calculated by looking through your funds to their underlying exposures. Check this looks right before proceeding.
        </div>

        {/* Missing data warning */}
        {missingData && (
          <div
            style={{
              background: 'rgba(200,150,30,0.1)',
              border: '1px solid rgba(200,150,30,0.35)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              fontFamily: 'Arial, sans-serif',
              fontSize: '0.78rem',
              color: '#c8960f',
              lineHeight: 1.6,
            }}
          >
            <strong>Some holdings are unclassified.</strong> Fund breakdown data was not provided for all holdings. Analysis of those positions will be based on fund name only — go back to add composition data for more precise results.
          </div>
        )}

        {/* Breakdown */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <Section title="Equities" total={equityTotal} items={equityItems} />
          <Section title="Bonds & Fixed Income" total={bondTotal} items={bondItems} />
          <Section title="Alternatives & Other" total={otherTotal} items={otherItems} />

          {sorted.length === 0 && (
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
              No breakdown available — add fund composition data to see look-through analysis.
            </div>
          )}
        </div>

        {/* Account weights */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.6rem' }}>
            Account weights
          </div>
          {profile.accounts.map((acc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <span>{acc.description} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({acc.taxWrapper})</span></span>
              <span style={{ color: 'var(--text-primary)' }}>{acc.approxValue || '—'}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              flex: '0 0 auto',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem 1.25rem',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              fontFamily: 'Arial, sans-serif',
              cursor: 'pointer',
            }}
          >
            ← Edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem',
              color: '#0d0f14',
              fontSize: '0.9rem',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Looks right — start analysis →
          </button>
        </div>
      </div>
    </div>
  )
}
