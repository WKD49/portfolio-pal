'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { UserProfile, PortfolioAccount } from '@/lib/types'

const GOALS = [
  'Grow my wealth',
  'Fund a large purchase',
  'Fund my retirement',
  'Something else',
  'All of these',
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
  return { description: '', taxWrapper: TAX_WRAPPERS[0], approxValue: '', allocation: '' }
}

function blankProfile(): UserProfile {
  return {
    sessionDate: new Date().toISOString().split('T')[0],
    marketNotes: '',
    baseCurrency: '',
    riskTolerance: 5,
    timeHorizon: '',
    goals: [],
    goalsOther: '',
    drawsIncome: false,
    incomeStartDate: '',
    accounts: [blankAccount()],
    fxExposures: '',
  }
}

interface Props {
  onComplete: (profile: UserProfile) => void
}

export default function OnboardingForm({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [draft, setDraft] = useState<UserProfile>(blankProfile)
  const [error, setError] = useState<string | null>(null)

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

  function advance() {
    setError(null)

    if (step === 1 && !draft.sessionDate) {
      setError('Please enter today\'s date.')
      return
    }
    if (step === 2) {
      if (!draft.baseCurrency.trim()) { setError('Please enter your base currency.'); return }
      if (!draft.timeHorizon.trim()) { setError('Please enter your time horizon.'); return }
      if (draft.goals.length === 0) { setError('Please select at least one goal.'); return }
    }
    if (step === 3) {
      if (!draft.accounts[0].description.trim()) {
        setError('Please add a description for Account 1.')
        return
      }
    }

    if (step < 4) {
      setStep((s) => (s + 1) as 1 | 2 | 3 | 4)
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
            Macro-aware portfolio rotation adviser
          </div>
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
          Step {step} of 4
        </div>

        {/* Step content — key forces remount and re-triggers fade-in */}
        <div key={step} className="fade-in">

          {step === 1 && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Today&apos;s date</label>
                <input
                  type="date"
                  value={draft.sessionDate}
                  onChange={(e) => set('sessionDate', e.target.value)}
                  style={{ ...field, colorScheme: 'dark' }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Any market notes? <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <textarea
                  value={draft.marketNotes}
                  onChange={(e) => set('marketNotes', e.target.value)}
                  placeholder="e.g. S&P down 3% this week, dollar weakening — optional but helps Portfolio Pal calibrate"
                  rows={3}
                  style={{ ...field, resize: 'vertical' }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Base currency</label>
                <input
                  type="text"
                  value={draft.baseCurrency}
                  onChange={(e) => set('baseCurrency', e.target.value)}
                  placeholder="e.g. GBP"
                  style={field}
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
                  placeholder="e.g. 10 years, until retirement"
                  style={field}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>Your goals</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {GOALS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      style={btnStyle(draft.goals.includes(g))}
                    >
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

          {step === 3 && (
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
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '0.1rem',
                        display: 'flex',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={label}>Brief description</label>
                    <input
                      type="text"
                      value={acc.description}
                      onChange={(e) => setAccount(i, 'description', e.target.value)}
                      placeholder="e.g. UK equity ISA, global tracker SIPP"
                      style={{ ...field, background: 'var(--bg-primary)' }}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={label}>Type of account</label>
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
                    <label style={label}>Approximate value</label>
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

                  <div style={{ marginBottom: draft.goals.length > 1 ? '0.85rem' : 0 }}>
                    <label style={label}>Approximate allocation</label>
                    <textarea
                      value={acc.allocation}
                      onChange={(e) => setAccount(i, 'allocation', e.target.value)}
                      placeholder="e.g. 60% global tracker, 30% UK equity, 10% bonds"
                      rows={2}
                      style={{ ...field, background: 'var(--bg-primary)', resize: 'vertical' }}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>

                  {draft.goals.length > 1 && (
                    <div>
                      <label style={label}>Primary goal for this account</label>
                      <select
                        value={acc.primaryGoal ?? ''}
                        onChange={(e) => setAccount(i, 'primaryGoal', e.target.value)}
                        style={{ ...field, background: 'var(--bg-primary)' }}
                        onFocus={focusOn}
                        onBlur={focusOff}
                      >
                        <option value="">— select —</option>
                        {draft.goals.map((g) => {
                          const label = g === 'Something else' && draft.goalsOther ? draft.goalsOther : g
                          return <option key={g} value={label}>{label}</option>
                        })}
                        <option value="All of them">All of them</option>
                      </select>
                    </div>
                  )}
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

          {step === 4 && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={label}>
                  Any significant foreign currency exposures across your accounts?{' '}
                  <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  value={draft.fxExposures}
                  onChange={(e) => set('fxExposures', e.target.value)}
                  placeholder="e.g. ~30% of ISA is in USD-denominated ETFs, unhedged"
                  rows={3}
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
                onClick={() => { setError(null); setStep((s) => (s - 1) as 1 | 2 | 3 | 4) }}
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
              {step < 4 ? 'Continue →' : 'Start my session →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
