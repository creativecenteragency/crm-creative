import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { initialAuthHashParams, supabase } from '../lib/supabase'
import type { Profile, Workspace } from '../types/database'

// Los links de invitación (?type=invite) hacen que supabase-js dispare SIGNED_IN en vez
// de PASSWORD_RECOVERY, así que el usuario invitado quedaba logueado sin haber elegido
// nunca una contraseña. Detectamos el link de invitación explícitamente por su hash.
const isInviteLink = initialAuthHashParams.get('type') === 'invite'

interface AuthState {
  session: Session | null
  profile: Profile | null
  workspaces: Workspace[] // workspaces el usuario puede ver (todos si es master)
  loading: boolean
  passwordRecovery: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

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
        if (isInviteLink) setPasswordRecovery(true)
        loadProfileAndWorkspaces(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isInviteLink)) {
        setPasswordRecovery(true)
      }

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

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setPasswordRecovery(false)
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, workspaces, loading, passwordRecovery, signIn, signOut, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
