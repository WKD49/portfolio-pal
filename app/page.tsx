'use client'

import { useState, useEffect } from 'react'
import { UserProfile } from '@/lib/types'
import OnboardingForm from '@/components/OnboardingForm'
import PortfolioSummary from '@/components/PortfolioSummary'
import ChatInterface from '@/components/ChatInterface'

const KEY = 'portfolioPalProfile'

type AppState = 'onboarding' | 'summary' | 'chat'

export default function Home() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [appState, setAppState] = useState<AppState>('onboarding')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored) {
        setProfile(JSON.parse(stored))
        setAppState('chat')
      }
    } catch {
      // ignore corrupt storage
    }
    setReady(true)
  }, [])

  if (!ready) return null

  if (appState === 'onboarding' || !profile) {
    return (
      <OnboardingForm
        onComplete={(p) => {
          setProfile(p)
          setAppState('summary')
        }}
      />
    )
  }

  if (appState === 'summary') {
    return (
      <PortfolioSummary
        profile={profile}
        onConfirm={() => {
          localStorage.setItem(KEY, JSON.stringify(profile))
          setAppState('chat')
        }}
        onBack={() => setAppState('onboarding')}
      />
    )
  }

  return (
    <ChatInterface
      userProfile={profile}
      onEditProfile={() => {
        setAppState('onboarding')
      }}
      onNewSession={() => {
        localStorage.removeItem(KEY)
        setProfile(null)
        setAppState('onboarding')
      }}
    />
  )
}
