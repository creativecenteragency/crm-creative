import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Workspace } from '../types/database'

interface AuthState {
  session: Session | null
  profile: Profile | null
  workspaces: Workspace[] // workspaces el usuario puede ver (todos si es master)
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  async function loadProfileAndWorkspaces(userId: string) {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(profileData ?? null)

    if (profileData?.is_master) {
      const { data } = await supabase.from('workspaces').select('*').order('name')
      setWorkspaces(data ?? [])
    } else {
      const { data } = await supabase
        .from('workspace_members')
        .select('workspaces(*)')
        .eq('user_id', userId)
      const ws = (data ?? []).map((row: any) => row.workspaces).filter(Boolean)
      setWorkspaces(ws)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        loadProfileAndWorkspaces(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        setLoading(true)
        loadProfileAndWorkspaces(newSession.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setWorkspaces([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, workspaces, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
