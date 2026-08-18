import { useMemo, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { parseCsv } from '../../lib/csv'
import { useWorkspaceFields } from '../../hooks/useAdmin'
import type { Lead, LeadRating, LeadStatus } from '../../types/database'

type CoreKey =
  | 'created_at'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'inquiry_type'
  | 'message'
  | 'source_channel'
  | 'status'
  | 'rating'

const CORE_FIELDS: { key: CoreKey; label: string }[] = [
  { key: 'created_at', label: 'Fecha' },
  { key: 'first_name', label: 'Nombre' },
  { key: 'last_name', label: 'Apellido' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'inquiry_type', label: 'Tipo de consulta' },
  { key: 'message', label: 'Mensaje' },
  { key: 'source_channel', label: 'Fuente' },
  { key: 'status', label: 'Estado' },
  { key: 'rating', label: 'Calificación' },
]

const CORE_GUESSES: Record<CoreKey, string[]> = {
  created_at: ['fecha', 'date', 'created_at'],
  first_name: ['nombre', 'first_name', 'name'],
  last_name: ['apellido', 'last_name'],
  email: ['email', 'correo'],
  phone: ['telefono', 'teléfono', 'phone'],
  inquiry_type: ['consulta', 'tipo de consulta', 'inquiry_type'],
  message: ['mensaje', 'message'],
  source_channel: [
    'fuente',
    'source',
    'source_channel',
    'canal',
    'origen',
    'medio',
    'utm_source',
    'como nos conociste',
    'cómo nos conociste',
  ],
  status: ['estado', 'status'],
  rating: ['calificacion', 'calificación', 'rating'],
}

const STATUS_MAP: Record<string, LeadStatus> = {
  nuevo: 'nuevo',
  new: 'nuevo',
  contactado: 'contactado',
  contacted: 'contactado',
  cotizado: 'cotizado',
  quoted: 'cotizado',
  ganado: 'ganado',
  won: 'ganado',
  perdido: 'perdido',
  lost: 'perdido',
}

const RATING_MAP: Record<string, LeadRating> = {
  bueno: 'bueno',
  good: 'bueno',
  regular: 'regular',
  malo: 'malo',
  bad: 'malo',
}

function normalizeStatus(v?: string): LeadStatus {
  if (!v) return 'nuevo'
  return STATUS_MAP[v.trim().toLowerCase()] ?? 'nuevo'
}

function normalizeRating(v?: string): LeadRating | null {
  if (!v) return null
  return RATING_MAP[v.trim().toLowerCase()] ?? null
}

function parseDate(v?: string): string {
  if (!v) return new Date().toISOString()
  const trimmed = v.trim()
  const m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    const [, d, mo, y] = m
    const year = y.length === 2 ? `20${y}` : y
    const date = new Date(Number(year), Number(mo) - 1, Number(d))
    if (!isNaN(date.getTime())) return date.toISOString()
  }
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) return parsed.toISOString()
  return new Date().toISOString()
}

const CHUNK_SIZE = 200

export default function CsvImportSection({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient()
  // Los "campos adicionales" configurados en Ajustes (selects, checkboxes, texto libre)
  // se suman como columnas mapeables más, para que el CSV pueda traer esos valores igual
  // que el webhook de Forminator los guarda en `extra`.
  const { data: workspaceFields } = useWorkspaceFields(workspaceId)
  const customFields = useMemo(
    () => (workspaceFields ?? []).filter((f) => f.key !== 'inquiry_type'),
    [workspaceFields]
  )
  const targetFields = useMemo(
    () => [...CORE_FIELDS, ...customFields.map((f) => ({ key: f.key, label: f.label }))],
    [customFields]
  )

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<{ inserted: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dataRows = rows.slice(1)

  function cell(row: string[], key: string): string | undefined {
    const header = mapping[key]
    if (!header) return undefined
    const idx = headers.indexOf(header)
    if (idx === -1) return undefined
    return row[idx]?.trim()
  }

  function buildLead(row: string[]): Partial<Lead> & { workspace_id: string } {
    const extra: Record<string, string> = {}
    for (const f of customFields) {
      const v = cell(row, f.key)
      if (v) extra[f.key] = v
    }
    return {
      workspace_id: workspaceId,
      created_at: parseDate(cell(row, 'created_at')),
      first_name: cell(row, 'first_name') || null,
      last_name: cell(row, 'last_name') || null,
      email: cell(row, 'email') || null,
      phone: cell(row, 'phone') || null,
      inquiry_type: cell(row, 'inquiry_type') || null,
      message: cell(row, 'message') || null,
      source_channel: cell(row, 'source_channel') || 'import',
      status: normalizeStatus(cell(row, 'status')),
      rating: normalizeRating(cell(row, 'rating')),
      is_spam: false,
      extra,
    }
  }

  const preview = useMemo(() => dataRows.slice(0, 5).map(buildLead), [dataRows, mapping, headers, customFields])

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''))
      if (parsed.length === 0) {
        setError('No se pudo leer ninguna fila del archivo.')
        return
      }
      setHeaders(parsed[0])
      setRows(parsed)
      // Auto-mapeo por coincidencia de nombre de columna.
      const guess: Record<string, string> = {}
      const lowerHeaders = parsed[0].map((h) => h.toLowerCase().trim())
      for (const field of CORE_FIELDS) {
        const idx = lowerHeaders.findIndex((h) => CORE_GUESSES[field.key].includes(h))
        if (idx !== -1) guess[field.key] = parsed[0][idx]
      }
      for (const f of customFields) {
        const candidates = [f.key.toLowerCase(), f.label.toLowerCase()]
        const idx = lowerHeaders.findIndex((h) => candidates.includes(h))
        if (idx !== -1) guess[f.key] = parsed[0][idx]
      }
      setMapping(guess)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    setResult(null)
    const leads = dataRows.map(buildLead)
    let inserted = 0
    let failed = 0
    setProgress({ done: 0, total: leads.length })

    for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
      const chunk = leads.slice(i, i + CHUNK_SIZE)
      const { error: insertError } = await supabase.from('leads').insert(chunk)
      if (insertError) {
        failed += chunk.length
      } else {
        inserted += chunk.length
      }
      setProgress({ done: Math.min(i + CHUNK_SIZE, leads.length), total: leads.length })
    }

    setImporting(false)
    setResult({ inserted, failed })
    if (inserted > 0) {
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
    }
  }

  function reset() {
    setFileName('')
    setRows([])
    setHeaders([])
    setMapping({})
    setResult(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {headers.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-brand-gray">
            {fileName} · {dataRows.length} filas detectadas.{' '}
            <button onClick={reset} className="text-brand-orange hover:underline">
              elegir otro archivo
            </button>
          </p>

          <div className="grid grid-cols-2 gap-2">
            {targetFields.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-2 items-center">
                <label className="text-sm text-slate-600">{label}</label>
                <select
                  value={mapping[key] ?? ''}
                  onChange={(e) =>
                    setMapping((prev) => {
                      const next = { ...prev }
                      if (e.target.value) next[key] = e.target.value
                      else delete next[key]
                      return next
                    })
                  }
                  className="rounded-md border border-brand-line px-2 py-1.5 text-sm"
                >
                  <option value="">No importar</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-medium text-brand-gray mb-1">Vista previa (primeras 5 filas)</p>
            <div className="overflow-x-auto rounded-md border border-brand-line">
              <table className="w-full text-xs">
                <thead className="bg-brand-cream text-left text-brand-gray uppercase">
                  <tr>
                    <th className="px-2 py-1.5">Fecha</th>
                    <th className="px-2 py-1.5">Nombre</th>
                    <th className="px-2 py-1.5">Email</th>
                    <th className="px-2 py-1.5">Teléfono</th>
                    <th className="px-2 py-1.5">Consulta</th>
                    <th className="px-2 py-1.5">Fuente</th>
                    <th className="px-2 py-1.5">Estado</th>
                    {customFields.map((f) => (
                      <th key={f.key} className="px-2 py-1.5">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((lead, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString('es-AR') : ''}
                      </td>
                      <td className="px-2 py-1.5">
                        {lead.first_name} {lead.last_name}
                      </td>
                      <td className="px-2 py-1.5">{lead.email}</td>
                      <td className="px-2 py-1.5">{lead.phone}</td>
                      <td className="px-2 py-1.5">{lead.inquiry_type}</td>
                      <td className="px-2 py-1.5">{lead.source_channel}</td>
                      <td className="px-2 py-1.5">{lead.status}</td>
                      {customFields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5">
                          {lead.extra?.[f.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || dataRows.length === 0}
            className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
          >
            {importing ? `Importando ${progress.done}/${progress.total}…` : `Importar ${dataRows.length} leads`}
          </button>

          {result && (
            <p className={`text-sm ${result.failed > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              Importados: {result.inserted}. {result.failed > 0 && `Con errores: ${result.failed}.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
