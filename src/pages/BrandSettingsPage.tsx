import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUpdateWorkspaceBranding, useWorkspaceBranding } from '../hooks/useWorkspaceBranding'
import { useWorkspace } from '../hooks/useAdmin'
import { wrapBrandedEmail } from '../lib/emailTemplate'

export default function BrandSettingsPage() {
  const { workspaceId } = useParams()
  const { data: branding, isLoading } = useWorkspaceBranding(workspaceId)
  const { data: workspace } = useWorkspace(workspaceId)
  const update = useUpdateWorkspaceBranding(workspaceId!)

  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#EA6A2A')
  const [signatureName, setSignatureName] = useState('')
  const [signatureRole, setSignatureRole] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLogoUrl(branding?.logo_url ?? '')
    setPrimaryColor(branding?.primary_color ?? '#EA6A2A')
    setSignatureName(branding?.signature_name ?? '')
    setSignatureRole(branding?.signature_role ?? '')
    setSaved(false)
  }, [branding])

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Cargando…</div>

  async function handleSave() {
    setSaving(true)
    await update.mutateAsync({
      logo_url: logoUrl || null,
      primary_color: primaryColor,
      signature_name: signatureName || null,
      signature_role: signatureRole || null,
    })
    setSaving(false)
    setSaved(true)
  }

  const previewHtml = wrapBrandedEmail(
    '<p>Hola Juan,</p><p>Así se va a ver el encabezado y la firma en los emails que mandes desde el CRM.</p>',
    { logo_url: logoUrl || null, primary_color: primaryColor, signature_name: signatureName || null, signature_role: signatureRole || null },
    workspace?.name ?? ''
  )

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-brand-carbon">Ajustes de marca</h1>
        <p className="text-sm text-brand-gray">
          Esto define cómo se ven el logo del menú y los emails que se mandan desde el CRM.
        </p>
      </div>

      <section className="space-y-4 bg-white border border-brand-line rounded-lg p-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-500">Logo (URL de la imagen)</label>
          <input
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value)
              setSaved(false)
            }}
            placeholder="https://…"
            className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-500">Color institucional</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value)
                setSaved(false)
              }}
              className="h-9 w-14 rounded-md border border-brand-line cursor-pointer"
            />
            <input
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value)
                setSaved(false)
              }}
              placeholder="#EA6A2A"
              className="w-32 rounded-md border border-brand-line px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-500">Firma — nombre</label>
            <input
              value={signatureName}
              onChange={(e) => {
                setSignatureName(e.target.value)
                setSaved(false)
              }}
              placeholder="Ej: María Gómez"
              className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-500">Firma — cargo / equipo</label>
            <input
              value={signatureRole}
              onChange={(e) => {
                setSignatureRole(e.target.value)
                setSaved(false)
              }}
              placeholder="Ej: Atención al cliente"
              className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brand-orange text-brand-carbon text-sm font-semibold px-4 py-2 hover:bg-brand-orange-dark disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && !saving && <span className="text-xs text-green-600">Guardado ✓</span>}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs text-slate-400">Vista previa de un email con estos ajustes:</p>
        <div className="border border-brand-line rounded-md bg-brand-cream p-4">
          <div className="bg-white rounded-md p-2" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </section>
    </div>
  )
}
