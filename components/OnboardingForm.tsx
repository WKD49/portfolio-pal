'use client'

import { useState, useRef } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { UserProfile, PortfolioAccount, AllocationItem } from '@/lib/types'
import { classifyHolding, classifyHoldingSource } from '@/lib/context-builder'

const GOALS = [
  'Grow my wealth',
  'Fund a large purchase',
  'Fund my retirement',
  'Something else',
]

const TAX_WRAPPERS = [
  'Stocks & Shares ISA',
  'Cash ISA',
  'SIPP',
  'Other pension',
  'Broker/GIA',
  'Savings account',
  'Other',
]

const field: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '0.65rem 0.85rem',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  fontFamily: 'Arial, sans-serif',
  outline: 'none',
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontFamily: 'Arial, sans-serif',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  marginBottom: '0.4rem',
}

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'var(--accent)'
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'var(--border)'
}

function blankAccount(): PortfolioAccount {
  return {
    description: '',
    taxWrapper: TAX_WRAPPERS[0],
    approxValue: '',
    allocation: [{ name: '', percentage: '' }],
  }
}

const TEST_PROFILE: UserProfile = {
  sessionDate: new Date().toISOString().split('T')[0],
  baseCurrency: 'GBP',
  riskTolerance: 7,
  timeHorizon: '6 years until retirement',
  age: '59',
  goals: ['Fund my retirement', 'Grow my wealth'],
  goalsOther: '',
  drawsIncome: true,
  incomeStartDate: '2030',
  accounts: [
    {
      description: 'ISA',
      taxWrapper: 'Stocks & Shares ISA',
      approxValue: '£200,000',
      allocation: [
        {
          name: 'Vanguard LifeStrategy 60/40',
          percentage: '50',
          compositionData: `Global Bond Index Fund GBP Hedged Acc	19.1%
FTSE Developed World ex-U.K. Equity Index Fund GBP Acc	19.0%
FTSE U.K. All Share Index Unit Trust GBP Acc	15.7%
U.S. Equity Index Fund GBP Acc	15.4%
U.K. Government Bond Index Fund GBP Acc	7.3%
Emerging Markets Stock Index Fund GBP Acc	5.2%
U.K. Investment Grade Bond Index Fund GBP Acc	3.5%
FTSE Developed Europe ex-U.K. Equity Index Fund GBP Acc	3.0%
Global Aggregate Bond UCITS ETF GBP Hedged Accumulating	2.9%
U.K. Inflation-Linked Gilt Index Fund GBP Acc	2.0%
Japan Stock Index Fund GBP Acc	1.6%
U.S. Government Bond Index Fund GBP Hedged Acc	1.4%
U.S. Investment Grade Credit Index Fund GBP Hedged Acc	1.1%
Euro Government Bond Index Fund GBP Hedged Acc	1.1%
Pacific ex-Japan Stock Index Fund GBP Acc	0.7%
Euro Investment Grade Bond Index Fund GBP Hedged Acc	0.6%
Japan Government Bond Index Fund GBP Hedged Acc	0.3%`,
        },
        { name: 'Global Shares Tracker', percentage: '25' },
        { name: 'Active IG GBP Bond Fund', percentage: '25' },
      ],
    },
    {
      description: 'SIPP',
      taxWrapper: 'SIPP',
      approxValue: '£500,000',
      allocation: [
        { name: 'Vanguard 2030 Target Retirement Fund', percentage: '50' },
        { name: 'Copper ETF', percentage: '10' },
        { name: 'European Equity Tracker', percentage: '20' },
        { name: 'Active Tech Fund', percentage: '20' },
      ],
    },
  ],
  individualPositionsPct: '',
  marketNotes: '',
}

function blankProfile(): UserProfile {
  return {
    sessionDate: new Date().toISOString().split('T')[0],
    baseCurrency: '',
    riskTolerance: 5,
    timeHorizon: '',
    age: '',
    goals: [],
    goalsOther: '',
    drawsIncome: false,
    incomeStartDate: '',
    accounts: [blankAccount()],
    individualPositionsPct: '',
    marketNotes: '',
  }
}

interface Props {
  onComplete: (profile: UserProfile) => void
}

export default function OnboardingForm({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [draft, setDraft] = useState<UserProfile>(blankProfile)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Track which allocation rows have composition panel open
  const [openComposition, setOpenComposition] = useState<Record<string, boolean>>({})

  function set<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setAccount(index: number, key: keyof PortfolioAccount, value: string) {
    setDraft((d) => {
      const accounts = [...d.accounts]
      accounts[index] = { ...accounts[index], [key]: value }
      return { ...d, accounts }
    })
  }

  function setAllocationItem(accountIndex: number, rowIndex: number, key: keyof AllocationItem, value: string) {
    setDraft((d) => {
      const accounts = [...d.accounts]
      const alloc = [...accounts[accountIndex].allocation]
      alloc[rowIndex] = { ...alloc[rowIndex], [key]: value }
      accounts[accountIndex] = { ...accounts[accountIndex], allocation: alloc }
      return { ...d, accounts }
    })
  }

  function addAllocationRow(accountIndex: number) {
    setDraft((d) => {
      const accounts = [...d.accounts]
      accounts[accountIndex] = {
        ...accounts[accountIndex],
        allocation: [...accounts[accountIndex].allocation, { name: '', percentage: '' }],
      }
      return { ...d, accounts }
    })
  }

  function removeAllocationRow(accountIndex: number, rowIndex: number) {
    setDraft((d) => {
      const accounts = [...d.accounts]
      accounts[accountIndex] = {
        ...accounts[accountIndex],
        allocation: accounts[accountIndex].allocation.filter((_, i) => i !== rowIndex),
      }
      return { ...d, accounts }
    })
  }

  function addAccount() {
    setDraft((d) => ({ ...d, accounts: [...d.accounts, blankAccount()] }))
  }

  function removeAccount(index: number) {
    setDraft((d) => ({ ...d, accounts: d.accounts.filter((_, i) => i !== index) }))
  }

  function toggleGoal(goal: string) {
    setDraft((d) => {
      const goals = d.goals.includes(goal)
        ? d.goals.filter((g) => g !== goal)
        : [...d.goals, goal]
      return { ...d, goals }
    })
  }

  function toggleComposition(accountIndex: number, rowIndex: number) {
    const key = `${accountIndex}-${rowIndex}`
    setOpenComposition((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function advance() {
    setError(null)

    if (step === 1) {
      if (!draft.baseCurrency.trim()) { setError('Please enter your base currency.'); return }
      if (!draft.timeHorizon.trim()) { setError('Please enter your time horizon.'); return }
      if (draft.goals.length === 0) { setError('Please select at least one goal.'); return }
    }
    if (step === 2) {
      if (draft.accounts[0].allocation.every(item => !item.name.trim())) {
        setError('Please add at least one holding to Account 1.')
        return
      }
    }

    if (step < 3) {
      setStep((s) => (s + 1) as 1 | 2 | 3)
      scrollRef.current?.scrollTo({ top: 0 })
    } else {
      onComplete(draft)
    }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--accent)' : 'var(--bg-surface)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: '6px',
    padding: '0.4rem 0.85rem',
    color: active ? '#0d0f14' : 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontFamily: 'Arial, sans-serif',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div
      ref={scrollRef}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '3rem 1.25rem 4rem',
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '2rem',
              color: 'var(--accent)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              marginBottom: '0.35rem',
            }}
          >
            Portfolio Pal
          </div>
          <div
            style={{
              fontFamily: 'Arial, sans-serif',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Macro-aware portfolio adviser
          </div>
        </div>

        {/* Test data shortcut */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => { setDraft({ ...TEST_PROFILE, sessionDate: new Date().toISOString().split('T')[0] }); setError(null) }}
            style={{
              background: 'none',
              border: '1px dashed var(--border)',
              borderRadius: '6px',
              padding: '0.3rem 0.75rem',
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              fontFamily: 'Arial, sans-serif',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            Fill test data
          </button>
        </div>

        {/* Progress */}
        <div
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
            textAlign: 'center',
          }}
        >
          Step {step} of 3
        </div>

        <div key={step} className="fade-in">

          {/* ── Step 1: About You ── */}
          {step === 1 && (
            <div>
              {/* Security notice */}
              <div
                style={{
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid rgba(201,168,76,0.25)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.5rem',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: 'var(--accent)' }}>Privacy notice:</strong> Portfolio Pal sends only percentage breakdowns and relative account weights to OpenAI for analysis. Your actual balance figures are never transmitted. Do not enter account numbers or your full name in any field.
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Base currency</label>
                <input
                  type="text"
                  value={draft.baseCurrency}
                  onChange={(e) => set('baseCurrency', e.target.value)}
                  placeholder="e.g. GBP"
                  style={{ ...field, width: '8rem' }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Your age</label>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={draft.age}
                  onChange={(e) => set('age', e.target.value)}
                  placeholder="e.g. 45"
                  style={{ ...field, width: '6rem' }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>
                  Attitude to investment risk &nbsp;
                  <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'none', letterSpacing: 0 }}>
                    {draft.riskTolerance} / 10
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={draft.riskTolerance}
                  onChange={(e) => set('riskTolerance', Number(e.target.value))}
                  className="onboarding-range"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  <span>Low risk</span><span>High risk</span>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Time horizon</label>
                <input
                  type="text"
                  value={draft.timeHorizon}
                  onChange={(e) => set('timeHorizon', e.target.value)}
                  placeholder="e.g. 10 years, until retirement in 2035"
                  style={field}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Your goals</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {GOALS.map((g) => (
                    <button key={g} type="button" onClick={() => toggleGoal(g)} style={btnStyle(draft.goals.includes(g))}>
                      {g}
                    </button>
                  ))}
                </div>
                {draft.goals.includes('Something else') && (
                  <div className="fade-in" style={{ marginTop: '0.85rem' }}>
                    <label style={label}>Please describe</label>
                    <input
                      type="text"
                      value={draft.goalsOther ?? ''}
                      onChange={(e) => set('goalsOther', e.target.value)}
                      placeholder="e.g. Build an emergency fund, save for school fees"
                      style={field}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Do you expect to draw income from your investments?</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => set('drawsIncome', true)} style={btnStyle(draft.drawsIncome)}>Yes</button>
                  <button type="button" onClick={() => set('drawsIncome', false)} style={btnStyle(!draft.drawsIncome)}>No</button>
                </div>
                {draft.drawsIncome && (
                  <div className="fade-in" style={{ marginTop: '0.85rem' }}>
                    <label style={label}>When would you ideally begin?</label>
                    <input
                      type="text"
                      value={draft.incomeStartDate}
                      onChange={(e) => set('incomeStartDate', e.target.value)}
                      placeholder="e.g. 2035, in 10 years, at 60"
                      style={field}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Your Accounts ── */}
          {step === 2 && (
            <div>
              {draft.accounts.map((acc, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Arial, sans-serif',
                      fontSize: '0.7rem',
                      color: 'var(--accent)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    Account {i + 1}
                  </div>

                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => removeAccount(i)}
                      style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.1rem', display: 'flex' }}
                    >
                      <X size={14} />
                    </button>
                  )}

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={label}>Account type</label>
                    <select
                      value={acc.taxWrapper}
                      onChange={(e) => setAccount(i, 'taxWrapper', e.target.value)}
                      style={{ ...field, background: 'var(--bg-primary)' }}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    >
                      {TAX_WRAPPERS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={label}>
                      Approximate value{' '}
                      <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(used for weighting only — no exact figures)</span>
                    </label>
                    <input
                      type="text"
                      value={acc.approxValue}
                      onChange={(e) => setAccount(i, 'approxValue', e.target.value)}
                      placeholder="e.g. £45,000"
                      style={{ ...field, background: 'var(--bg-primary)' }}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>

                  <div>
                    <label style={label}>Holdings</label>

                    {acc.allocation.map((item, ri) => {
                      const compKey = `${i}-${ri}`
                      const compOpen = openComposition[compKey] ?? false
                      const hasComposition = !!item.compositionData?.trim()
                      const source = item.name.trim() ? classifyHoldingSource(item.name.trim()) : 'unclassified'
                      // Green = user has explicitly pasted exact breakdown data
                      // Amber = auto-estimated (known index or pattern approximation)
                      // Red = genuinely unknown
                      const btnColor = hasComposition
                        ? '#4aaf70'
                        : source !== 'unclassified'
                          ? '#c8960f'
                          : '#e07070'
                      const btnBg = hasComposition
                        ? 'rgba(74,175,112,0.12)'
                        : source !== 'unclassified'
                          ? 'rgba(200,150,30,0.1)'
                          : 'rgba(224,112,112,0.1)'
                      const btnBorder = hasComposition
                        ? 'rgba(74,175,112,0.35)'
                        : source !== 'unclassified'
                          ? 'rgba(200,150,30,0.35)'
                          : 'rgba(224,112,112,0.35)'
                      return (
                        <div key={ri} style={{ marginBottom: '0.6rem' }}>
                          {/* Fund name + % row */}
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => setAllocationItem(i, ri, 'name', e.target.value)}
                              placeholder="e.g. Vanguard LifeStrategy 60/40"
                              style={{ ...field, background: 'var(--bg-primary)', flex: 1 }}
                              onFocus={focusOn}
                              onBlur={focusOff}
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.percentage}
                              onChange={(e) => setAllocationItem(i, ri, 'percentage', e.target.value)}
                              placeholder="%"
                              style={{ ...field, background: 'var(--bg-primary)', width: '68px', flexShrink: 0 }}
                              onFocus={focusOn}
                              onBlur={focusOff}
                            />
                            {/* Expand composition toggle — colour reflects classification confidence */}
                            <button
                              type="button"
                              onClick={() => toggleComposition(i, ri)}
                              title={compOpen ? 'Hide fund breakdown' : 'Add fund breakdown'}
                              style={{
                                background: item.name.trim() ? btnBg : 'none',
                                border: `1px solid ${item.name.trim() ? btnBorder : 'var(--border)'}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: item.name.trim() ? btnColor : 'var(--text-muted)',
                                padding: '0.35rem',
                                display: 'flex',
                                flexShrink: 0,
                              }}
                            >
                              {compOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {acc.allocation.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeAllocationRow(i, ri)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.1rem', display: 'flex', flexShrink: 0 }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Composition data panel */}
                          {compOpen && (() => {
                            const trimmedName = item.name.trim()
                            const approxBreakdown = !hasComposition && (source === 'known-index' || source === 'pattern')
                              ? classifyHolding(trimmedName)
                              : null
                            const needsBreakdown = !hasComposition && source === 'unclassified'
                            const borderColor = needsBreakdown ? 'var(--accent)' : source === 'pattern' ? 'rgba(200,150,30,0.5)' : source === 'known-index' ? 'rgba(74,175,112,0.4)' : 'var(--border)'
                            return (
                            <div className="fade-in" style={{ marginTop: '0.5rem', paddingLeft: '0.5rem', borderLeft: `2px solid ${borderColor}` }}>
                              <label style={{ ...label, color: needsBreakdown ? 'var(--accent)' : 'var(--text-muted)' }}>
                                Fund breakdown{' '}
                                {needsBreakdown
                                  ? <span style={{ color: 'var(--accent)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— needed for accurate look-through</span>
                                  : hasComposition
                                    ? <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(user-provided)</span>
                                    : source === 'known-index'
                                      ? <span style={{ color: '#4aaf70', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— known index data</span>
                                      : <span style={{ color: '#c8960f', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— estimated from index approximation</span>
                                }
                              </label>

                              {/* Approximate breakdown preview */}
                              {approxBreakdown && (
                                <div style={{ marginBottom: '0.6rem' }}>
                                  <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.35rem', lineHeight: 1.5 }}>
                                    {source === 'known-index'
                                      ? 'Portfolio Pal will use this breakdown automatically — no action needed. You can paste the exact factsheet data below to improve precision.'
                                      : 'Approximate breakdown — Portfolio Pal will use this as a best-effort estimate. Paste the exact factsheet data below to improve precision.'
                                    }
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {approxBreakdown.map(({ subClass, pct }) => (
                                      <span
                                        key={subClass}
                                        style={{
                                          background: source === 'known-index' ? 'rgba(74,175,112,0.1)' : 'rgba(200,150,30,0.1)',
                                          border: `1px solid ${source === 'known-index' ? 'rgba(74,175,112,0.3)' : 'rgba(200,150,30,0.3)'}`,
                                          borderRadius: '4px',
                                          padding: '2px 7px',
                                          fontSize: '0.65rem',
                                          fontFamily: 'Arial, sans-serif',
                                          color: source === 'known-index' ? '#4aaf70' : '#c8960f',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {subClass}: {pct.toFixed(1)}%
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {!approxBreakdown && !hasComposition && (
                                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', lineHeight: 1.5 }}>
                                  Go to the fund&apos;s product page, find the holdings or portfolio breakdown table, and paste it here. This lets Portfolio Pal analyse your sub-asset class exposure precisely.
                                </div>
                              )}

                              <textarea
                                value={item.compositionData ?? ''}
                                onChange={(e) => setAllocationItem(i, ri, 'compositionData', e.target.value)}
                                placeholder={approxBreakdown
                                  ? `Paste exact factsheet data here to override the estimate above\ne.g.\nFTSE U.K. All Share Index\t15.7%\nU.S. Equity Index Fund\t15.4%\n...`
                                  : `e.g.\nFTSE U.K. All Share Index\t15.7%\nU.S. Equity Index Fund\t15.4%\n...`
                                }
                                rows={4}
                                style={{ ...field, background: 'var(--bg-primary)', resize: 'vertical', fontSize: '0.78rem' }}
                                onFocus={focusOn}
                                onBlur={focusOff}
                              />
                            </div>
                          )})()}
                        </div>
                      )
                    })}

                    {/* Allocation total */}
                    {(() => {
                      const total = acc.allocation.reduce((sum, item) => sum + (parseFloat(item.percentage) || 0), 0)
                      const hasAny = acc.allocation.some(item => item.percentage !== '')
                      if (!hasAny) return null
                      const color = total > 100 ? '#e07070' : total === 100 ? 'var(--accent)' : '#c8960f'
                      return (
                        <div style={{ textAlign: 'right', fontSize: '0.72rem', fontFamily: 'Arial, sans-serif', color, marginBottom: '0.4rem' }}>
                          Total: {total}%{total === 100 ? ' ✓' : ''}
                        </div>
                      )
                    })()}

                    <button
                      type="button"
                      onClick={() => addAllocationRow(i)}
                      style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: '6px', padding: '0.3rem 0.7rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'Arial, sans-serif', cursor: 'pointer', letterSpacing: '0.03em' }}
                    >
                      + Add holding
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addAccount}
                style={{
                  width: '100%',
                  background: 'none',
                  border: '1px dashed var(--accent)',
                  borderRadius: '8px',
                  padding: '0.65rem',
                  color: 'var(--accent)',
                  fontSize: '0.82rem',
                  fontFamily: 'Arial, sans-serif',
                  cursor: 'pointer',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.04em',
                }}
              >
                + Add another account
              </button>
            </div>
          )}

          {/* ── Step 3: Additional Context ── */}
          {step === 3 && (
            <div>
              {/* Look-through nudge — show holdings missing composition data */}
              {(() => {
                const missing: { account: string; holding: string }[] = []
                for (const acc of draft.accounts) {
                  for (const item of acc.allocation) {
                    const name = item.name.trim()
                    if (!name) continue
                    // Skip if user has already pasted a breakdown
                    if (item.compositionData?.trim()) continue
                    // Skip if the name auto-classifies via known patterns
                    const result = classifyHolding(name)
                    const isUnclassified = result.length === 1 && result[0].subClass === 'Other / unclassified'
                    if (isUnclassified) {
                      missing.push({ account: acc.taxWrapper || 'Account', holding: name })
                    }
                  }
                }
                if (missing.length === 0) return null
                return (
                  <div
                    style={{
                      background: 'rgba(201,168,76,0.07)',
                      border: '1px solid rgba(201,168,76,0.3)',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      marginBottom: '1.5rem',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Look-through analysis incomplete
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '0.6rem' }}>
                      The following holdings have no fund breakdown. Portfolio Pal will show them as unclassified, which may skew your sub-asset class picture. If you can provide a breakdown, go back and paste it in.
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {missing.map((m, i) => (
                        <li key={i}>
                          <span style={{ color: 'var(--text-primary)' }}>{m.holding}</span>
                          <span style={{ color: 'var(--text-muted)' }}> — {m.account}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        // Auto-expand composition panels for all unclassified holdings
                        const expanded: Record<string, boolean> = { ...openComposition }
                        draft.accounts.forEach((acc, ai) => {
                          acc.allocation.forEach((item, ri) => {
                            const name = item.name.trim()
                            if (!name || item.compositionData?.trim()) return
                            const result = classifyHolding(name)
                            const isUnclassified = result.length === 1 && result[0].subClass === 'Other / unclassified'
                            if (isUnclassified) expanded[`${ai}-${ri}`] = true
                          })
                        })
                        setOpenComposition(expanded)
                        setStep(2)
                        scrollRef.current?.scrollTo({ top: 0 })
                      }}
                      style={{
                        marginTop: '0.65rem',
                        background: 'none',
                        border: '1px solid rgba(201,168,76,0.4)',
                        borderRadius: '6px',
                        padding: '0.3rem 0.75rem',
                        color: 'var(--accent)',
                        fontSize: '0.73rem',
                        fontFamily: 'Arial, sans-serif',
                        cursor: 'pointer',
                        letterSpacing: '0.03em',
                      }}
                    >
                      ← Go back and add breakdown
                    </button>
                  </div>
                )
              })()}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>
                  Individual positions{' '}
                  <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                  If you allocate a small portion of your portfolio to individual stocks or concentrated bets, enter the approximate percentage here. Portfolio Pal will assess this separately.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={draft.individualPositionsPct ?? ''}
                    onChange={(e) => set('individualPositionsPct', e.target.value)}
                    placeholder="0"
                    style={{ ...field, width: '5rem' }}
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                  <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.9rem', color: 'var(--text-muted)' }}>% of total portfolio</span>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>
                  Qualitative market context{' '}
                  <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(optional but recommended)</span>
                </label>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                  Live macro data is pulled in automatically, but numbers alone don&apos;t tell the full story. Add your interpretation of the current environment — what the trends mean, what you&apos;re reading, what the market narrative is right now.
                  <br /><br />
                  Tip: ask Gemini or ChatGPT — <em>&ldquo;You are a strategic asset allocator. Give me a qualitative summary of the current macro environment — what the trends in rates, currencies, commodities and equities are telling us, and what the key risks are.&rdquo;</em> — and paste the response here.
                </div>
                <textarea
                  value={draft.marketNotes ?? ''}
                  onChange={(e) => set('marketNotes', e.target.value)}
                  placeholder="e.g. Concerned about US tech valuations after recent rally. Read FT piece on ECB divergence from Fed..."
                  rows={4}
                  style={{ ...field, resize: 'vertical' }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: 'rgba(220,60,60,0.1)',
                border: '1px solid rgba(220,60,60,0.3)',
                borderRadius: '6px',
                padding: '0.6rem 0.85rem',
                color: '#e07070',
                fontSize: '0.82rem',
                fontFamily: 'Arial, sans-serif',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setError(null); setStep((s) => (s - 1) as 1 | 2 | 3); scrollRef.current?.scrollTo({ top: 0 }) }}
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
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={advance}
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
              {step < 3 ? 'Continue →' : 'Build my portfolio →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
