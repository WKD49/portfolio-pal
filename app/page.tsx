'use client'

import { useState, useEffect } from 'react'
import { UserProfile } from '@/lib/types'
import OnboardingForm from '@/components/OnboardingForm'
import ChatInterface from '@/components/ChatInterface'

const KEY = 'portfolioPalProfile'

export default function Home() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored) setProfile(JSON.parse(stored))
    } catch {
      // ignore corrupt storage
    }
    setReady(true)
  }, [])

  // Prevent flash of onboarding on return visits
  if (!ready) return null

  if (!profile) {
    return (
      <OnboardingForm
        onComplete={(p) => {
          localStorage.setItem(KEY, JSON.stringify(p))
          setProfile(p)
        }}
      />
    )
  }

  return (
    <ChatInterface
      userProfile={profile}
      onEditProfile={() => setProfile(null)}
    />
  )
}
