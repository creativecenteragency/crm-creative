import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useUpdateWorkspaceBranding, useWorkspaceBranding } from '../hooks/useWorkspaceBranding'
import { useMyWorkspaceRole, useWorkspace } from '../hooks/useAdmin'
import { wrapBrandedEmail } from '../lib/emailTemplate'

// Límite generoso para un logo de menú/email, pero que evite que alguien
// suba una foto de varios MB sin comprimir (se guarda como data URL en la fila).
const MAX_LOGO_BYTES = 800 * 1024

export default function BrandSettingsPage() {
  const { workspaceId } = useParams()
  const { data: branding, isLoading } = useWorkspaceBranding(workspaceId)
  const { data: workspace } = useWorkspace(workspaceId)
  const update = useUpdateWorkspaceBranding(workspaceId!)
  const { role, isLoading: roleLoading } = useMyWorkspaceRole(workspaceId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [logoUrl, setLogoUrl] = useState('')
  const [logoError, setLogoError] = useState<string | null>(null)
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

  if (isLoading || roleLoading) return <div className="p-8 text-sm text-slate-500">Cargando…</div>
  if (!workspaceId) return null
  if (role !== 'admin') return <Navigate to={`/w/${workspaceId}/leads`} replace />

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo si hace falta
    if (!file) return
    setLogoError(null)
    if (!file.type.startsWith('image/')) {
      setLogoError('Elegí un archivo de imagen (PNG, JPG o SVG).')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('La imagen pesa demasiado (máx. 800 KB). Achicala o exportá una versión más liviana.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoUrl(reader.result as string)
      setSaved(false)
    }
    reader.onerror = () => setLogoError('No se pudo leer el archivo.')
    reader.readAsDataURL(file)
  }

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
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-brand-carbon">Ajustes de marca</h1>
        <p className="text-sm text-brand-gray">
          Esto define cómo se ven el logo del menú y los emails que se mandan desde el CRM.
        </p>
      </div>

      <section className="space-y-4 bg-white border border-brand-line rounded-lg p-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-500">Logo</label>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 rounded-md border border-brand-line bg-white flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-h-9 max-w-9 object-contain" />
              ) : (
                <span className="text-[10px] text-slate-300">Sin logo</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md border border-brand-line px-3 py-1.5 text-sm font-medium text-brand-carbon hover:bg-brand-cream"
                >
                  Examinar…
                </button>
                <span className="text-xs text-slate-400">o pegá una URL</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
              <input
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value)
                  setLogoError(null)
                  setSaved(false)
                }}
                placeholder="https://…"
                className="w-full rounded-md border border-brand-line px-3 py-2 text-sm"
              />
            </div>
          </div>
          {logoError && <p className="text-xs text-red-600">{logoError}</p>}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <iframe title="Vista previa del email" srcDoc={previewHtml} className="w-full h-[420px] rounded-md border border-brand-line bg-white" />
        </div>
      </section>
    </div>
  )
}
