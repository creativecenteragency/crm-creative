import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({
  children,
  masterOnly = false,
}: {
  children: ReactNode
  masterOnly?: boolean
}) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Cargando…</div>
  }

  if (!session) return <Navigate to="/login" replace />
  if (masterOnly && !profile?.is_master) return <Navigate to="/" replace />

  return <>{children}</>
}
