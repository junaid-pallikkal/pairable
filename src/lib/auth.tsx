import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // Defer: calling supabase inside this callback can deadlock.
      setTimeout(() => loadProfile(s?.user.id), 0)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value: AuthState = {
    session,
    profile,
    loading,
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** For pages that only render when signed in. */
export function useMe(): { id: string; profile: Profile } {
  const { session, profile } = useAuth()
  if (!session || !profile) throw new Error('Not signed in')
  return { id: session.user.id, profile }
}
