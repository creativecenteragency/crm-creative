import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLeads } from '../hooks/useLeads'
import type { Lead } from '../types/database'
import { StatusBadge } from '../components/LeadBadges'
import WhatsAppButton from '../components/WhatsAppButton'
import LeadDrawer from '../components/LeadDrawer'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// No usar `new Date(iso).toLocaleDateString()` para una fecha sin hora: al pasar por
// Date, JS la interpreta como medianoche UTC y la reconvierte a la zona local, lo que
// en Argentina (UTC-3) la muestra un día antes. Formateamos directo desde el string.
function formatDateOnly(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function dueLabel(dateStr: string): { text: string; className: string } {
  const today = todayStr()
  if (dateStr < today) return { text: 'Atrasado', className: 'bg-red-100 text-red-700' }
  if (dateStr === today) return { text: 'Hoy', className: 'bg-amber-100 text-amber-700' }
  return { text: 'Próximo', className: 'bg-slate-100 text-slate-600' }
}

export default function FollowUpsPage() {
  const { workspaceId } = useParams()
  const { data: leads, isLoading, error } = useLeads(workspaceId)
  const [selected, setSelected] = useState<Lead | null>(null)

  const followUps = useMemo(() => {
    return (leads ?? [])
      .filter((l) => l.next_contact_at && l.status !== 'ganado' && l.status !== 'perdido' && !l.is_spam)
      .sort((a, b) => (a.next_contact_at! < b.next_contact_at! ? -1 : 1))
  }, [leads])

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando seguimientos…</div>
  if (error) return <div className="p-8 text-sm text-red-600">Error cargando seguimientos.</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-brand-carbon">Seguimientos</h1>
        <p className="text-sm text-brand-gray">{followUps.length} pendientes</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream text-left text-xs font-medium text-brand-gray uppercase">
            <tr>
              <th className="px-4 py-2.5">Fecha</th>
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5">Contacto</th>
              <th className="px-4 py-2.5">Consulta</th>
              <th className="px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {followUps.map((lead) => {
              const due = dueLabel(lead.next_contact_at!.slice(0, 10))
              return (
                <tr key={lead.id} onClick={() => setSelected(lead)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${due.className}`}>
                      {due.text}
                    </span>
                    <span className="ml-2 text-slate-500">{formatDateOnly(lead.next_contact_at!)}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    <div>{lead.email}</div>
                    <div className="flex items-center gap-1.5">
                      <span>{lead.phone}</span>
                      <WhatsAppButton phone={lead.phone} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{lead.inquiry_type}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={lead.status} />
                  </td>
                </tr>
              )
            })}
            {followUps.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No hay seguimientos programados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <LeadDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
