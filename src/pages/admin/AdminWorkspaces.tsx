import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAllWorkspaces, useCreateWorkspace } from '../../hooks/useAdmin'

export default function AdminWorkspaces() {
  const { data: workspaces, isLoading, error } = useAllWorkspaces()
  const createWorkspace = useCreateWorkspace()
  const [name, setName] = useState('')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createWorkspace.mutateAsync(name.trim())
    setName('')
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Clientes</h1>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del cliente (ej: Salvaguarda)"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createWorkspace.isPending}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          + Nuevo cliente
        </button>
      </form>
      {createWorkspace.error && (
        <p className="text-sm text-red-600">{(createWorkspace.error as Error).message}</p>
      )}

      {isLoading && <p className="text-sm text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">Error cargando clientes.</p>}

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {(workspaces ?? []).map((ws) => (
          <Link
            key={ws.id}
            to={`/admin/workspaces/${ws.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">{ws.name}</p>
              <p className="text-xs text-slate-400">{ws.slug}</p>
            </div>
            <span className="text-slate-400 text-sm">Configurar →</span>
          </Link>
        ))}
        {workspaces?.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Todavía no creaste ningún cliente.</p>
        )}
      </div>
    </div>
  )
}
