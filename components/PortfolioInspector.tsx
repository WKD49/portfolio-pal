'use client'

import { useState } from 'react'
import { AccountTrace, HoldingTrace, SubItemTrace } from '@/lib/context-builder'

// ─── Badge helpers ────────────────────────────────────────────────────────────

type BadgeKind = 'composition-data' | 'known-index' | 'pattern' | 'unclassified' | string

function badgeStyle(kind: BadgeKind): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '0.62rem',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: '1px 6px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  }
  switch (kind) {
    case 'composition-data':
      return { ...base, background: 'rgba(196,164,90,0.18)', color: 'var(--accent)', border: '1px solid rgba(196,164,90,0.4)' }
    case 'known-index':
      return { ...base, background: 'rgba(74,158,255,0.15)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.35)' }
    case 'pattern':
      return { ...base, background: 'rgba(74,175,112,0.15)', color: '#4aaf70', border: '1px solid rgba(74,175,112,0.35)' }
    case 'unclassified':
    default:
      return { ...base, background: 'rgba(224,112,112,0.15)', color: '#e07070', border: '1px solid rgba(224,112,112,0.35)' }
  }
}

function badgeLabel(kind: BadgeKind): string {
  switch (kind) {
    case 'composition-data': return 'composition data'
    case 'known-index':      return 'known fund'
    case 'pattern':          return 'pattern match'
    case 'country-map':      return 'country map'
    default:                 return 'unclassified'
  }
}

function ClassificationBadge({ kind }: { kind: BadgeKind }) {
  return <span style={badgeStyle(kind)}>{badgeLabel(kind)}</span>
}

// ─── Allocation chips ─────────────────────────────────────────────────────────

function AllocationChips({ allocations }: { allocations: Array<{ subClass: string; portfolioPct: number }> }) {
  if (allocations.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
      {allocations.map(({ subClass, portfolioPct }) => (
        <span
          key={subClass}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '1px 7px',
            fontSize: '0.65rem',
            fontFamily: 'Arial, sans-serif',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {subClass}: {portfolioPct.toFixed(2)}%
        </span>
      ))}
    </div>
  )
}

// ─── Sub-item row (nested, for composition-data holdings) ─────────────────────

function SubItemRow({ item }: { item: SubItemTrace }) {
  const top2 = item.allocations.slice(0, 2)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '4px 0',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span
        style={{
          color: 'var(--text-muted)',
          fontSize: '0.7rem',
          fontFamily: 'Arial, sans-serif',
          minWidth: '20px',
          marginTop: '1px',
        }}
      >
        →
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span
            style={{
              fontSize: '0.73rem',
              fontFamily: 'Arial, sans-serif',
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
          >
            {item.name}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Arial, sans-serif' }}>
            {item.pct.toFixed(1)}% of fund
          </span>
          <ClassificationBadge kind={item.classifiedBy} />
          {top2.map(({ subClass, portfolioPct }) => (
            <span
              key={subClass}
              style={{
                fontSize: '0.63rem',
                fontFamily: 'Arial, sans-serif',
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '1px 5px',
                whiteSpace: 'nowrap',
              }}
            >
              {subClass}: {portfolioPct.toFixed(2)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-items collapsible list ───────────────────────────────────────────────

const SUB_ITEMS_INITIAL_COUNT = 5

function SubItemsList({ subItems }: { subItems: SubItemTrace[] }) {
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? subItems : subItems.slice(0, SUB_ITEMS_INITIAL_COUNT)
  const hasMore = subItems.length > SUB_ITEMS_INITIAL_COUNT

  return (
    <div
      style={{
        marginTop: '8px',
        marginLeft: '12px',
        paddingLeft: '12px',
        borderLeft: '2px solid rgba(196,164,90,0.25)',
      }}
    >
      {visible.map((item, i) => (
        <SubItemRow key={i} item={item} />
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: '0.68rem',
            fontFamily: 'Arial, sans-serif',
            padding: '4px 0',
            opacity: 0.8,
          }}
        >
          {expanded
            ? `▲ show less`
            : `▼ show ${subItems.length - SUB_ITEMS_INITIAL_COUNT} more`}
        </button>
      )}
    </div>
  )
}

// ─── Holding row ──────────────────────────────────────────────────────────────

function HoldingRow({ holding }: { holding: HoldingTrace }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '10px 14px',
        marginBottom: '8px',
      }}
    >
      {/* Top row: name + percentages + badge */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span
          style={{
            fontSize: '0.82rem',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 600,
            color: 'var(--text-primary)',
            flex: 1,
            minWidth: '140px',
          }}
        >
          {holding.name}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap' }}>
          {holding.holdingPct.toFixed(1)}% of account
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap' }}>
          {holding.portfolioPct.toFixed(2)}% of portfolio
        </span>
        <ClassificationBadge kind={holding.classifiedBy} />
      </div>

      {/* Sub-asset chips */}
      <AllocationChips allocations={holding.allocations} />

      {/* Sub-items (look-through) */}
      {holding.classifiedBy === 'composition-data' && holding.subItems && holding.subItems.length > 0 && (
        <SubItemsList subItems={holding.subItems} />
      )}
    </div>
  )
}

// ─── Account section ──────────────────────────────────────────────────────────

function AccountSection({ account }: { account: AccountTrace }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontSize: '0.85rem',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}
        >
          {account.label}
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            fontFamily: 'Arial, sans-serif',
            color: 'var(--accent)',
            fontWeight: 600,
          }}
        >
          {account.weightPct}% of portfolio
        </span>
      </div>

      {account.holdings.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Arial, sans-serif' }}>
          No holdings found.
        </p>
      ) : (
        account.holdings.map((h, i) => <HoldingRow key={i} holding={h} />)
      )}
    </div>
  )
}

// ─── Main inspector panel ─────────────────────────────────────────────────────

interface PortfolioInspectorProps {
  trace: AccountTrace[]
  onClose: () => void
}

export default function PortfolioInspector({ trace, onClose }: PortfolioInspectorProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'var(--bg-primary)',
        overflowY: 'auto',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 51,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontWeight: 600,
              marginBottom: '0.2rem',
            }}
          >
            Portfolio Calculation Trace
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '600px' }}>
            Shows how each holding was classified and what it contributes to your sub-asset breakdown.
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close inspector"
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '1.1rem',
            lineHeight: 1,
            fontFamily: 'Arial, sans-serif',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        {trace.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No portfolio data to display.
          </p>
        ) : (
          trace.map((account, i) => <AccountSection key={i} account={account} />)
        )}
      </div>
    </div>
  )
}
