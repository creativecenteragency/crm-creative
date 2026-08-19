import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../hooks/useLeads'
import { useWorkspaceBranding } from '../hooks/useWorkspaceBranding'
import { usePushSubscription } from '../hooks/usePushSubscription'
import type { Workspace } from '../types/database'
import BrandMark from './BrandMark'

function dueFollowUpsCount(leads: ReturnType<typeof useLeads>['data']): number {
  if (!leads) return 0
  const today = new Date().toISOString().slice(0, 10)
  return leads.filter(
    (l) => l.next_contact_at && l.next_contact_at.slice(0, 10) <= today && l.status !== 'ganado' && l.status !== 'perdido' && !l.is_spam
  ).length
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `block rounded-md border-l-2 px-2.5 py-1.5 text-sm transition-colors ${
    isActive
      ? 'border-brand-orange bg-white text-brand-carbon font-medium shadow-sm'
      : 'border-transparent text-brand-gray hover:bg-white/70 hover:text-brand-carbon'
  }`
}

function WorkspaceBrand({ workspace }: { workspace: Workspace }) {
  const [imgError, setImgError] = useState(false)
  const { data: branding } = useWorkspaceBranding(workspace.id)
  const logoUrl = branding?.logo_url

  if (logoUrl && !imgError) {
    return (
      <div className="rounded-md bg-brand-carbon px-3 py-2 flex items-center justify-center">
        {/* El logo suele ser una variante clara pensada para fondo oscuro */}
        <img
          src={logoUrl}
          alt={workspace.name}
          className="max-h-7 w-auto object-contain"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return <p className="text-sm font-semibold font-display text-brand-carbon px-1">{workspace.name}</p>
}

function PushNotificationToggle({ workspaceId }: { workspaceId: string }) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushSubscription(workspaceId)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setError(null)
    try {
      if (isSubscribed) await unsubscribe.mutateAsync()
      else await subscribe.mutateAsync()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!isSupported) {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (!isIOS || isStandalone) return null
    return (
      <p className="px-2 pt-1 text-xs text-brand-gray">
        Para recibir avisos de leads en este iPhone, agregá esta app a tu pantalla de inicio primero.
      </p>
    )
  }

  return (
    <div className="pt-1">
      <button
        onClick={toggle}
        disabled={isLoading || subscribe.isPending || unsubscribe.isPending}
        className={`w-full text-left rounded-md border-l-2 px-2.5 py-1.5 text-sm transition-colors disabled:opacity-50 ${
          isSubscribed
            ? 'border-brand-orange bg-white text-brand-carbon font-medium shadow-sm'
            : 'border-transparent text-brand-gray hover:bg-white/70 hover:text-brand-carbon'
        }`}
      >
        🔔 {isSubscribed ? 'Avisos activados' : 'Avisarme de leads nuevos'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1 px-2">{error}</p>}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, workspaces, signOut } = useAuth()
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId)
  const { data: leads } = useLeads(currentWorkspace?.id)
  const dueCount = dueFollowUpsCount(leads)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Al navegar a otra pantalla, cerramos el drawer mobile solo.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen flex bg-brand-cream">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform overflow-y-auto transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 md:transform-none ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } shrink-0 border-r border-brand-line bg-brand-cream flex flex-col`}
      >
        <div className="p-4 border-b border-brand-line flex items-center gap-2">
          <BrandMark className="h-6 w-6 text-brand-carbon shrink-0" />
          <div>
            <p className="text-sm font-semibold font-display text-brand-carbon leading-tight">CRM Creative</p>
            {profile?.is_master && <p className="text-xs text-brand-gray leading-tight">Cuenta agencia</p>}
          </div>
        </div>

        {workspaces.length > 1 && (
          <div className="p-3 border-b border-brand-line">
            <label className="block text-xs font-medium text-brand-gray mb-1">Cliente</label>
            <select
              className="w-full text-sm rounded-md border border-brand-line bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
              value={workspaceId ?? ''}
              onChange={(e) => navigate(`/w/${e.target.value}/leads`)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {currentWorkspace && (
          <nav className="p-3 space-y-2 text-sm">
            <WorkspaceBrand workspace={currentWorkspace} />
            <div className="space-y-1 pt-1">
              <NavLink to={`/w/${currentWorkspace.id}/leads`} className={navLinkClass}>
                Tabla de leads
              </NavLink>
              <NavLink to={`/w/${currentWorkspace.id}/kanban`} className={navLinkClass}>
                Kanban
              </NavLink>
              <NavLink to={`/w/${currentWorkspace.id}/followups`} className={navLinkClass}>
                <span className="inline-flex items-center gap-1.5">
                  Seguimientos
                  {dueCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-brand-orange text-brand-carbon text-xs font-semibold px-1">
                      {dueCount}
                    </span>
                  )}
                </span>
              </NavLink>
              <NavLink to={`/w/${currentWorkspace.id}/metrics`} className={navLinkClass}>
                Métricas
              </NavLink>
              <NavLink to={`/w/${currentWorkspace.id}/templates`} className={navLinkClass}>
                Plantillas
              </NavLink>
              <NavLink to={`/w/${currentWorkspace.id}/settings`} className={navLinkClass}>
                Ajustes
              </NavLink>
              <NavLink to={`/w/${currentWorkspace.id}/config`} className={navLinkClass}>
                Configuración
              </NavLink>
            </div>
            <div className="pt-2 mt-2 border-t border-brand-line">
              <PushNotificationToggle workspaceId={currentWorkspace.id} />
            </div>
          </nav>
        )}

        {profile?.is_master && (
          <nav className="p-3 space-y-1 text-sm border-t border-brand-line mt-auto">
            <p className="px-2 text-xs font-semibold text-brand-gray uppercase tracking-wide mb-1">Agencia</p>
            <NavLink to="/admin" className={navLinkClass}>
              Administrar clientes
            </NavLink>
          </nav>
        )}

        <div className="p-3 border-t border-brand-line">
          <button
            onClick={() => signOut()}
            className="w-full text-left text-sm text-brand-gray hover:text-brand-carbon px-2 py-1.5 rounded-md hover:bg-white/70"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden flex items-center gap-3 border-b border-brand-line bg-white px-4 py-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menú"
            className="text-brand-carbon text-xl leading-none px-1 py-1 rounded-md hover:bg-brand-cream"
          >
            ☰
          </button>
          <span className="text-sm font-semibold font-display text-brand-carbon truncate">
            {currentWorkspace?.name ?? 'CRM Creative'}
          </span>
        </header>

        <main className="flex-1 min-w-0 overflow-auto bg-brand-cream">
          <div className="min-h-full bg-white">{children}</div>
        </main>
      </div>
    </div>
  )
}
