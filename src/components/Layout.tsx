import { type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, workspaces, signOut } = useAuth()
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId)

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">CRM Creative</p>
          {profile?.is_master && <p className="text-xs text-slate-400 mt-0.5">Cuenta agencia</p>}
        </div>

        {workspaces.length > 1 && (
          <div className="p-3 border-b border-slate-100">
            <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
            <select
              className="w-full text-sm rounded-md border border-slate-300 px-2 py-1.5"
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
          <nav className="p-3 space-y-1 text-sm">
            <p className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              {currentWorkspace.name}
            </p>
            <Link
              to={`/w/${currentWorkspace.id}/leads`}
              className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              Tabla de leads
            </Link>
            <Link
              to={`/w/${currentWorkspace.id}/kanban`}
              className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              Kanban
            </Link>
          </nav>
        )}

        {profile?.is_master && (
          <nav className="p-3 space-y-1 text-sm border-t border-slate-100 mt-auto">
            <p className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Agencia</p>
            <Link to="/admin" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
              Administrar clientes
            </Link>
          </nav>
        )}

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => signOut()}
            className="w-full text-left text-sm text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-md hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}
